import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { BASE_UNITS, toBase, toBig } from "@/lib/ingredient-units";

/**
 * Цена и минимальный остаток вводятся в крупной единице (за 1 кг / 1 л / 1 шт),
 * в базе хранятся за 1 г / 1 мл / 1 шт.
 */
export const ingredientSchema = z.object({
  name: z.string().trim().min(2, "Укажите название (например, Клубника)").max(80, "Слишком длинное название"),
  category: z.string().trim().min(2, "Укажите категорию (например, Ягоды)").max(40, "Слишком длинная категория"),
  unit: z.enum(BASE_UNITS, { error: "Выберите единицу: граммы, миллилитры или штуки" }),
  price: z.coerce.number({ error: "Цена должна быть числом" }).min(0, "Цена не может быть отрицательной").max(100_000_000, "Слишком большая цена"),
  minStock: z.coerce.number({ error: "Минимальный остаток должен быть числом" }).min(0, "Остаток не может быть отрицательным").max(1_000_000, "Слишком большой остаток"),
  shelfLifeDays: z.number().int("Срок — целое число дней").min(1, "Срок должен быть от 1 дня").max(3650, "Слишком большой срок").nullable(),
  supplierId: z.string().min(1).nullable(),
});
export type IngredientInput = z.infer<typeof ingredientSchema>;

/** Из полей формы: пустые строки превращаем в «не задано». */
export function ingredientFromForm(fd: FormData): unknown {
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  return {
    name: s("name"), category: s("category"), unit: s("unit"),
    price: s("price") || "0", minStock: s("minStock") || "0",
    shelfLifeDays: s("shelfLifeDays") ? Number(s("shelfLifeDays")) : null,
    supplierId: s("supplierId") || null,
  };
}

const D = (n: number) => new Prisma.Decimal(n);

async function assertUniqueName(name: string, exceptId?: string) {
  const dup = await prisma.ingredient.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (dup) throw new ApiError(400, `Ингредиент «${dup.name}» уже есть. Откройте его и измените, а не создавайте второй.`);
}

async function nextSku() {
  const rows = await prisma.ingredient.findMany({ where: { sku: { startsWith: "ING-" } }, select: { sku: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(/^ING-(\d+)$/.exec(r.sku)?.[1] ?? 0)), 0);
  return `ING-${String(max + 1).padStart(4, "0")}`;
}

export async function createIngredient(input: unknown, userId: string) {
  const d = ingredientSchema.parse(input);
  await assertUniqueName(d.name);
  if (d.supplierId && !(await prisma.supplier.findUnique({ where: { id: d.supplierId }, select: { id: true } }))) throw new ApiError(400, "Поставщик не найден");
  const minBase = toBase(d.unit, d.minStock);
  for (let attempt = 0; ; attempt++) {
    try {
      const ing = await prisma.ingredient.create({
        data: {
          sku: await nextSku(), name: d.name, category: d.category, unit: d.unit,
          minStock: D(minBase), maxStock: D(minBase * 4),
          avgCost: D(d.price / toBase(d.unit, 1)).toDecimalPlaces(2),
          shelfLifeDays: d.shelfLifeDays, supplierId: d.supplierId,
        },
      });
      await audit({ userId, action: "INGREDIENT_CREATED", entity: "Ingredient", entityId: ing.id, newValue: { name: d.name, unit: d.unit, price: d.price } });
      return ing;
    } catch (e) {
      if ((e as { code?: string } | null)?.code === "P2002" && attempt < 4) continue; // гонка за SKU: берём следующий
      throw e;
    }
  }
}

/** Ингредиент уже участвует в учёте: менять единицу и удалять нельзя. */
async function usage(id: string) {
  const [recipes, purchases, txs, writeOffs, batches] = await Promise.all([
    prisma.recipeItem.count({ where: { ingredientId: id } }),
    prisma.purchaseItem.count({ where: { ingredientId: id } }),
    prisma.inventoryTransaction.count({ where: { ingredientId: id } }),
    prisma.writeOff.count({ where: { ingredientId: id } }),
    prisma.batch.count({ where: { ingredientId: id } }),
  ]);
  return { recipes, inUse: recipes + purchases + txs + writeOffs + batches > 0 };
}

export async function updateIngredient(id: string, input: unknown, userId: string) {
  const d = ingredientSchema.parse(input);
  const old = await prisma.ingredient.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Ингредиент не найден");
  await assertUniqueName(d.name, id);
  if (d.supplierId && !(await prisma.supplier.findUnique({ where: { id: d.supplierId }, select: { id: true } }))) throw new ApiError(400, "Поставщик не найден");
  const sameUnit = d.unit === old.unit;
  if (!sameUnit && (await usage(id)).inUse) throw new ApiError(400, "Единицу измерения нельзя менять: по ингредиенту уже есть рецепты, приходы или списания.");
  const unit = sameUnit ? old.unit : d.unit;
  const minBase = toBase(unit, d.minStock);
  await prisma.ingredient.update({
    where: { id },
    data: {
      name: d.name, category: d.category, unit, minStock: D(minBase),
      maxStock: D(Math.max(Number(old.maxStock), minBase)),
      avgCost: D(d.price / toBase(unit, 1)).toDecimalPlaces(2),
      shelfLifeDays: d.shelfLifeDays, supplierId: d.supplierId,
    },
  });
  await audit({
    userId, action: "INGREDIENT_UPDATED", entity: "Ingredient", entityId: id,
    oldValue: { name: old.name, unit: old.unit, price: toBig(old.unit, Number(old.avgCost) * toBase(old.unit, 1)), minStock: toBig(old.unit, Number(old.minStock)) },
    newValue: { name: d.name, unit, price: d.price, minStock: d.minStock },
  });
}

export async function deleteIngredient(id: string, userId: string) {
  const ing = await prisma.ingredient.findUnique({ where: { id } });
  if (!ing) throw new ApiError(404, "Ингредиент не найден");
  if ((await usage(id)).inUse) throw new ApiError(400, "Нельзя удалить: ингредиент есть в рецептах или по нему были приходы и списания. Уберите его из рецептов или просто не используйте.");
  await prisma.ingredient.delete({ where: { id } });
  await audit({ userId, action: "INGREDIENT_DELETED", entity: "Ingredient", entityId: id, oldValue: { name: ing.name } });
}

/** Список с остатком в выбранной точке (или по всем) и числом рецептов, где ингредиент используется. */
export async function listIngredients(locationId: string | null) {
  const rows = await prisma.ingredient.findMany({
    include: { supplier: { select: { name: true } }, stocks: locationId ? { where: { locationId } } : true, _count: { select: { recipeItems: true } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map((i) => {
    const stock = i.stocks.reduce((a, s) => a + Number(s.quantity), 0);
    const min = Number(i.minStock);
    return {
      id: i.id, sku: i.sku, name: i.name, category: i.category, unit: i.unit, stock, min,
      low: min > 0 && stock < min, price: Number(i.avgCost) * toBase(i.unit, 1),
      supplier: i.supplier?.name ?? null, recipes: i._count.recipeItems,
    };
  });
}

export async function getIngredient(id: string) {
  const i = await prisma.ingredient.findUnique({
    where: { id },
    include: {
      stocks: { include: { location: { select: { name: true } } } },
      recipeItems: { include: { recipe: { include: { product: { select: { id: true, name: true } } } } } },
    },
  });
  if (!i) return null;
  const u = await usage(id);
  return {
    id: i.id, sku: i.sku, name: i.name, category: i.category, unit: i.unit,
    price: Number(i.avgCost) * toBase(i.unit, 1), minStock: toBig(i.unit, Number(i.minStock)),
    shelfLifeDays: i.shelfLifeDays, supplierId: i.supplierId, locked: u.inUse,
    stocks: i.stocks.map((s) => ({ location: s.location.name, quantity: Number(s.quantity) })),
    usedIn: i.recipeItems.map((r) => ({ productId: r.recipe.product.id, name: r.recipe.product.name, quantity: Number(r.quantity) })),
  };
}

export const categorySuggestions = async () => {
  const rows = await prisma.ingredient.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } });
  const base = ["Фрукты", "Ягоды", "Овощи", "Зелень", "Молочное", "Напитки и сиропы", "Топпинги", "Сыпучее", "Упаковка"];
  return [...new Set([...rows.map((r) => r.category), ...base])];
};
