import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { createProduct } from "@/services/products";
import { createIngredient } from "@/services/ingredients";
import { saveRecipe } from "@/services/recipes";
import { alignQuantity, describeProduct, guessCategory, matchIngredient, parseDraft, sameIngredient, scaleFor, scaleQty, type Unit } from "@/lib/product-draft";

export type PreviewItem = { ingredientId: string | null; name: string; unit: Unit; quantity: number };
export type PreviewSize = { name: string; price: number | null; items: PreviewItem[] };
export type Preview = {
  name: string; categoryId: string | null; description: string; sizes: PreviewSize[]; warnings: string[];
  categories: { id: string; name: string }[];
  /** ингредиенты, которых нет на складе: создадутся новыми */
  newIngredients: string[];
};

/** Разбирает описание и подбирает ингредиенты склада. Ничего не создаёт. */
export async function buildPreview(text: string): Promise<Preview> {
  const raw = String(text ?? "").trim();
  if (raw.length < 3) throw new ApiError(400, "Опишите продукт: название, состав с граммами, размеры и цену");
  if (raw.length > 3000) throw new ApiError(400, "Слишком длинное описание (до 3000 символов)");
  const draft = parseDraft(raw);
  if (!draft.ingredients.length) throw new ApiError(400, "Не нашла ингредиенты. Пишите так: «яблоко 300 г, морковь 150 г». Название и количество граммов обязательны.");
  const [stock, categories] = await Promise.all([
    prisma.ingredient.findMany({ select: { id: true, name: true, unit: true, pieceWeightG: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { sort: "asc" }, select: { id: true, name: true } }),
  ]);
  const warnings = [...draft.warnings];
  const stockView = stock.map((s) => ({ ...s, unit: s.unit as string, pieceWeightG: s.pieceWeightG == null ? null : Number(s.pieceWeightG) }));

  // количества на первый размер; один ингредиент дважды складываем
  const base: PreviewItem[] = [];
  for (const d of draft.ingredients) {
    const hit = matchIngredient(d.name, stockView);
    let item: PreviewItem;
    if (hit) {
      if (!sameIngredient(d.name, hit.name)) warnings.push(`«${d.name}» принято как «${hit.name}» со склада. Если это другой ингредиент, поправьте в рецепте.`);
      const a = alignQuantity(d, hit.unit, hit.pieceWeightG);
      if (a.warning) warnings.push(a.warning);
      if (!(a.quantity > 0)) continue;
      item = { ingredientId: hit.id, name: hit.name, unit: (hit.unit === "KG" ? "G" : hit.unit === "L" ? "ML" : hit.unit) as Unit, quantity: a.quantity };
    } else item = { ingredientId: null, name: d.name, unit: d.unit, quantity: d.quantity };
    const dup = base.find((b) => (b.ingredientId && b.ingredientId === item.ingredientId) || (!b.ingredientId && !item.ingredientId && b.name.toLowerCase() === item.name.toLowerCase()));
    if (dup) dup.quantity += item.quantity; else base.push(item);
  }
  if (!base.length) throw new ApiError(400, "Не получилось определить количество ингредиентов. Укажите граммы: «яблоко 300 г».");
  const sizes: PreviewSize[] = draft.sizes.map((s, i) => {
    const k = scaleFor(draft.sizes, i);
    return { name: s.name, price: s.price, items: base.map((b) => ({ ...b, quantity: scaleQty(b.quantity, k, b.unit) })) };
  });
  if (!draft.name) warnings.push("Не нашла название продукта: впишите его ниже.");
  const cat = guessCategory(draft.name, categories);
  if (!cat) warnings.push("Не смогла определить категорию: выберите её ниже.");
  return {
    name: draft.name, categoryId: cat?.id ?? null, categories, sizes, warnings,
    description: describeProduct(draft.name, base.map((b) => b.name)),
    newIngredients: [...new Set(base.filter((b) => !b.ingredientId).map((b) => b.name))],
  };
}

const itemSchema = z.object({
  ingredientId: z.string().min(1).nullish(),
  name: z.string().trim().min(2, "Название ингредиента: минимум 2 символа").max(60, "Название ингредиента слишком длинное"),
  unit: z.enum(["G", "ML", "PC"]),
  quantity: z.coerce.number({ error: "Укажите количество" }).positive("Количество должно быть больше 0").max(1_000_000),
});
export const createFromPreviewSchema = z.object({
  name: z.string().trim().min(2, "Название: минимум 2 символа").max(80, "Название слишком длинное"),
  categoryId: z.string().min(1, "Выберите категорию"),
  description: z.string().trim().max(500, "Описание: максимум 500 символов").optional(),
  sizes: z.array(z.object({
    name: z.string().trim().min(1, "Название размера не может быть пустым").max(40, "Название размера слишком длинное"),
    price: z.coerce.number({ error: "Укажите цену" }).int("Цена: целое число").min(1, "Цена должна быть больше 0").max(10_000_000, "Слишком большая цена"),
    items: z.array(itemSchema).min(1, "В каждом размере нужен хотя бы один ингредиент").max(40),
  })).min(1, "Нужен хотя бы один размер").max(10, "Слишком много размеров"),
});

/** Создаёт недостающие ингредиенты, продукт (сразу в меню), размеры и рецепт. Если рецепт не сохранился, продукт откатывается. */
export async function createFromPreview(input: unknown, userId: string) {
  const d = createFromPreviewSchema.parse(input);
  const names = d.sizes.map((s) => s.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new ApiError(400, "Названия размеров не должны повторяться");

  // ингредиенты: существующие по id, новые создаём (с защитой от повторов и гонок)
  const resolved = new Map<string, string>(); // ключ → id
  const key = (i: { ingredientId?: string | null; name: string }) => i.ingredientId ?? `new:${i.name.toLowerCase()}`;
  const ids = [...new Set(d.sizes.flatMap((s) => s.items).map((i) => i.ingredientId).filter((x): x is string => !!x))];
  if (ids.length) {
    const got = await prisma.ingredient.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (got.length !== ids.length) throw new ApiError(400, "Один из ингредиентов склада не найден. Разберите описание заново.");
    for (const g of got) resolved.set(g.id, g.id);
  }
  const fresh = new Map<string, { name: string; unit: Unit }>();
  for (const i of d.sizes.flatMap((s) => s.items)) if (!i.ingredientId && !fresh.has(key(i))) fresh.set(key(i), { name: i.name, unit: i.unit });
  const createdIngredients: string[] = [];
  for (const [k, v] of fresh) {
    const existing = await prisma.ingredient.findFirst({ where: { name: { equals: v.name, mode: "insensitive" } }, select: { id: true } });
    if (existing) { resolved.set(k, existing.id); continue; }
    const ing = await createIngredient({ name: v.name, category: "Прочее", unit: v.unit, price: "0", minStock: "0", shelfLifeDays: null, supplierId: null }, userId);
    resolved.set(k, ing.id);
    createdIngredients.push(ing.name);
  }

  const first = [...d.sizes].sort((a, b) => a.price - b.price)[0];
  const product = await createProduct({ name: d.name, description: d.description ?? "", categoryId: d.categoryId, price: first.price, isAvailable: true, prepMinutes: 3 }, userId);
  try {
    await saveRecipe(product.id, {
      sizes: d.sizes.map((s) => ({ optionId: null, name: s.name, price: s.price, items: s.items.map((i) => ({ ingredientId: resolved.get(key(i))!, quantity: i.quantity })) })),
    }, userId);
  } catch (e) {
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
    throw e;
  }
  return { id: product.id, name: product.name, createdIngredients };
}
