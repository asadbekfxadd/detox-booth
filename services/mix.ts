import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { isPackaging } from "@/lib/costing";
import {
  MIX_MAX_SIZES, MIX_PRODUCT_NAME, MIX_PRODUCT_SLUG, mixInputSchema, mixable, mixModifiers, mixPortions, mixPrice,
  type MixIngredient, type MixInput, type MixSize,
} from "@/lib/mix";

type Db = Prisma.TransactionClient | typeof prisma;
type Actor = { id: string; role: Role; locationId: string | null };

const SIZES_KEY = "mix.sizes";
/** Подсказка для первой настройки. Пока владелец не сохранил размеры, микс на сайте и кассе выключен. */
export const SUGGESTED_SIZES: Omit<MixSize, "id">[] = [
  { name: "300 мл", price: 20000, grams: 380, cupIngredientId: null },
  { name: "400 мл", price: 25000, grams: 500, cupIngredientId: null },
];

const sizeSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, "Назовите размер (например, 400 мл)").max(24, "Слишком длинное название размера"),
  price: z.number({ error: "Цена размера должна быть числом" }).min(0, "Цена не может быть отрицательной").max(10_000_000, "Слишком большая цена"),
  grams: z.number({ error: "Масса состава должна быть числом" }).min(50, "Масса состава — от 50 г").max(5000, "Масса состава — до 5000 г"),
  cupIngredientId: z.string().min(1).max(40).nullable(),
});

/** Размеры из настроек. Нет записи или она повреждена — микс выключен (пустой список). */
export async function getMixSizes(db: Db = prisma): Promise<MixSize[]> {
  const row = await db.setting.findUnique({ where: { key: SIZES_KEY } });
  const parsed = z.array(sizeSchema).safeParse(row?.value);
  return parsed.success ? parsed.data : [];
}

/**
 * Системная позиция «Свой микс»: в заказе у каждой строки должен быть товар. Она в архиве, чтобы не попадать в меню
 * (на сайте, в кассе, в акциях и калькуляции), а состав и цену строка несёт в modifiers.
 * Категорию «Свой микс» можно привязать к станции (кухня/бар) в разделе «Категории».
 */
export async function ensureMixProduct(db: Db = prisma): Promise<{ id: string; categoryId: string }> {
  const find = () => db.product.findUnique({ where: { slug: MIX_PRODUCT_SLUG }, select: { id: true, categoryId: true } });
  const have = await find();
  if (have) return have;
  try {
    const cat = (await db.category.findUnique({ where: { slug: MIX_PRODUCT_SLUG } }))
      ?? (await db.category.findUnique({ where: { name: MIX_PRODUCT_NAME } }))
      ?? (await db.category.create({ data: { name: MIX_PRODUCT_NAME, slug: MIX_PRODUCT_SLUG, sort: 900 } }));
    return await db.product.create({
      data: {
        name: MIX_PRODUCT_NAME, slug: MIX_PRODUCT_SLUG, categoryId: cat.id, price: 0, isArchived: true, isAvailable: true,
        description: "Системная позиция: стакан из ингредиентов, которые выбрал гость. В меню не показывается.",
      },
      select: { id: true, categoryId: true },
    });
  } catch (e) {
    // два первых заказа одновременно: товар уже создал соседний запрос
    if ((e as { code?: string } | null)?.code === "P2002") { const again = await find(); if (again) return again; }
    throw e;
  }
}

const toIngredient = (i: { id: string; name: string; category: string; unit: string; mixSurcharge: Prisma.Decimal; pieceWeightG: Prisma.Decimal | null }): MixIngredient => ({
  id: i.id, name: i.name, category: i.category, unit: i.unit, surcharge: Number(i.mixSurcharge), pieceWeightG: i.pieceWeightG == null ? null : Number(i.pieceWeightG),
});


/** Проверяет выбор гостя и считает цену и состав. Всё берётся из базы, браузеру верим только в id. */
export async function resolveMix(db: Db, input: MixInput) {
  const d = mixInputSchema.parse(input);
  const sizes = await getMixSizes(db);
  if (sizes.length === 0) throw new ApiError(400, "«Свой микс» сейчас недоступен");
  const size = sizes.find((s) => s.id === d.sizeId);
  if (!size) throw new ApiError(400, "Этот размер больше не доступен, выберите микс заново");
  const ids = [...new Set(d.ingredientIds)];
  const rows = await db.ingredient.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, toIngredient(r)]));
  // порядок как в запросе: так состав в чеке совпадает с тем, что выбрал гость
  const chosen = ids.map((id) => byId.get(id));
  if (chosen.some((c) => !c || !mixable(c))) throw new ApiError(400, "Один из ингредиентов больше не доступен для микса, обновите страницу");
  const list = chosen as MixIngredient[];
  const portions = mixPortions(size, list);
  return { size, chosen: list, portions, price: mixPrice(size, list), modifiers: mixModifiers(size, portions) };
}

// ───────────── Каталог для сайта, кассы и официанта ─────────────
export type MixCatalog = {
  productId: string;
  sizes: { id: string; name: string; price: number; grams: number }[];
  ingredients: { id: string; name: string; category: string; surcharge: number }[];
};

/**
 * Что гость может выбрать на этой точке: размеры из настроек и ингредиенты, которые есть на складе точки.
 * stock — остатки непросроченных партий (usableStock). Нет размеров или нет ингредиентов — null, и микс нигде не показывается.
 */
export async function getMixCatalog(db: Db, stock: Map<string, Prisma.Decimal>): Promise<MixCatalog | null> {
  const sizes = await getMixSizes(db);
  if (sizes.length === 0) return null;
  const rows = await db.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  const ingredients = rows.map(toIngredient).filter((i) => mixable(i) && Number(stock.get(i.id) ?? 0) > 0);
  if (ingredients.length === 0) return null;
  const product = await ensureMixProduct(db);
  return {
    productId: product.id,
    sizes: sizes.map((s) => ({ id: s.id, name: s.name, price: s.price, grams: s.grams })),
    ingredients: ingredients.map((i) => ({ id: i.id, name: i.name, category: i.category, surcharge: i.surcharge })),
  };
}

// ───────────── Настройка владельцем ─────────────
export async function getMixAdmin() {
  const [stored, rows] = await Promise.all([
    prisma.setting.findUnique({ where: { key: SIZES_KEY } }),
    prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  const sizes = await getMixSizes();
  const all = rows.map(toIngredient);
  return {
    configured: stored != null && sizes.length > 0,
    sizes,
    packaging: all.filter((i) => isPackaging(i.category)).map((i) => ({ id: i.id, name: i.name })),
    ingredients: all.filter((i) => !isPackaging(i.category)).map((i) => ({ ...i, mixable: mixable(i) })),
  };
}

export const saveMixSchema = z.object({
  sizes: z.array(sizeSchema).max(MIX_MAX_SIZES, `Размеров не больше ${MIX_MAX_SIZES}`),
  ingredients: z.array(z.object({
    id: z.string().min(1).max(40),
    surcharge: z.number({ error: "Доплата должна быть числом" }).min(0, "Доплата не может быть отрицательной").max(10_000_000, "Слишком большая доплата"),
    pieceWeightG: z.number({ error: "Вес штуки должен быть числом" }).min(1, "Вес штуки — от 1 г").max(5000, "Вес штуки — до 5000 г").nullable(),
  })).max(2000),
});
export type SaveMixInput = z.input<typeof saveMixSchema>;

export async function saveMix(input: unknown, user: Actor) {
  const d = saveMixSchema.parse(input);
  const names = new Set<string>();
  for (const s of d.sizes) {
    const k = s.name.toLowerCase();
    if (names.has(k)) throw new ApiError(400, `Размер «${s.name}» указан дважды`);
    names.add(k);
  }
  const cupIds = [...new Set(d.sizes.map((s) => s.cupIngredientId).filter((x): x is string => !!x))];
  if (cupIds.length) {
    const cups = await prisma.ingredient.findMany({ where: { id: { in: cupIds } }, select: { id: true, category: true } });
    if (cups.length !== cupIds.length || cups.some((c) => !isPackaging(c.category))) throw new ApiError(400, "Стаканчик выберите из ингредиентов категории «Упаковка»");
  }
  const current = await prisma.ingredient.findMany({ where: { id: { in: d.ingredients.map((i) => i.id) } }, select: { id: true, name: true, mixSurcharge: true, pieceWeightG: true } });
  const cur = new Map(current.map((c) => [c.id, c]));
  const changed = d.ingredients.filter((i) => {
    const c = cur.get(i.id);
    if (!c) return false;
    return Number(c.mixSurcharge) !== i.surcharge || (c.pieceWeightG == null ? null : Number(c.pieceWeightG)) !== i.pieceWeightG;
  });
  const before = await getMixSizes();
  const sizesChanged = JSON.stringify(before) !== JSON.stringify(d.sizes);
  await prisma.$transaction([
    ...(sizesChanged || before.length === 0 ? [prisma.setting.upsert({ where: { key: SIZES_KEY }, create: { key: SIZES_KEY, value: d.sizes }, update: { value: d.sizes } })] : []),
    ...changed.map((i) => prisma.ingredient.update({ where: { id: i.id }, data: { mixSurcharge: i.surcharge, pieceWeightG: i.pieceWeightG } })),
  ]);
  if (sizesChanged || changed.length) {
    try {
      await audit({
        userId: user.id, action: "MIX_SETTINGS_CHANGED", entity: "Setting", entityId: SIZES_KEY,
        oldValue: sizesChanged ? { sizes: before } : undefined,
        newValue: { ...(sizesChanged ? { sizes: d.sizes } : {}), ingredients: changed.map((i) => ({ name: cur.get(i.id)!.name, surcharge: i.surcharge, pieceWeightG: i.pieceWeightG })) },
      });
    } catch (e) { console.error("[AUDIT ERROR]", e); }
  }
  return { sizes: sizesChanged ? 1 : 0, ingredients: changed.length };
}
