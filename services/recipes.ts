import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

export const recipeSchema = z.object({
  items: z.array(z.object({
    ingredientId: z.string().min(1, "Выберите ингредиент"),
    quantity: z.coerce.number({ error: "Укажите количество" }).positive("Количество должно быть больше 0").max(1_000_000, "Слишком большое количество"),
  })).min(1, "Добавьте хотя бы один ингредиент").max(40, "Слишком много ингредиентов"),
}).refine((v) => new Set(v.items.map((i) => i.ingredientId)).size === v.items.length, { message: "Один ингредиент указан дважды" });

/** Список продуктов с рецептом, себестоимостью и числом порций, которые можно приготовить из остатков. */
export async function listRecipes(locationId: string | null, withCost: boolean) {
  const [products, stocks] = await Promise.all([
    prisma.product.findMany({
      where: { isArchived: false },
      include: { category: true, recipe: { include: { items: { include: { ingredient: true } } } } },
      orderBy: [{ category: { sort: "asc" } }, { name: "asc" }],
    }),
    prisma.stockItem.findMany({ where: locationId ? { locationId } : {} }),
  ]);
  const stock = new Map<string, number>();
  for (const s of stocks) stock.set(s.ingredientId, (stock.get(s.ingredientId) ?? 0) + Number(s.quantity));

  return products.map((p) => {
    const items = p.recipe?.items ?? [];
    const cost = items.reduce((a, i) => a + Number(i.quantity) * Number(i.ingredient.avgCost), 0);
    const portions = items.length
      ? Math.max(0, Math.min(...items.map((i) => Math.floor((stock.get(i.ingredientId) ?? 0) / Number(i.quantity)))))
      : null;
    return {
      id: p.id, name: p.name, category: p.category.name, price: Number(p.price),
      ingredients: items.length, hasRecipe: items.length > 0, portions,
      cost: withCost && items.length ? cost : null,
    };
  });
}

export async function getRecipe(productId: string) {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: { recipe: { include: { items: { include: { ingredient: true } } } } },
  });
  if (!p) return null;
  return {
    product: { id: p.id, name: p.name, price: Number(p.price) },
    items: (p.recipe?.items ?? []).map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) })),
  };
}

export async function saveRecipe(productId: string, input: unknown, userId: string) {
  const { items } = recipeSchema.parse(input);
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { recipe: { include: { items: true } } } });
  if (!product) throw new ApiError(404, "Продукт не найден");
  const found = await prisma.ingredient.count({ where: { id: { in: items.map((i) => i.ingredientId) } } });
  if (found !== items.length) throw new ApiError(400, "Один из ингредиентов не найден");

  const oldItems = (product.recipe?.items ?? []).map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) }));
  await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.upsert({ where: { productId }, create: { productId }, update: {} });
    await tx.recipeItem.deleteMany({ where: { recipeId: recipe.id } });
    await tx.recipeItem.createMany({ data: items.map((i) => ({ recipeId: recipe.id, ingredientId: i.ingredientId, quantity: i.quantity })) });
  });
  await audit({ userId, action: "RECIPE_CHANGED", entity: "Recipe", entityId: productId, oldValue: { items: oldItems }, newValue: { items } });
}
