import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { findSizeModifier } from "@/lib/recipe-size";

const itemsSchema = z.array(z.object({
  ingredientId: z.string().min(1, "Выберите ингредиент"),
  quantity: z.coerce.number({ error: "Укажите количество" }).positive("Количество должно быть больше 0").max(1_000_000, "Слишком большое количество"),
})).min(1, "Добавьте хотя бы один ингредиент").max(40, "Слишком много ингредиентов")
  .refine((v) => new Set(v.map((i) => i.ingredientId)).size === v.length, { message: "Один ингредиент указан дважды" });

export const recipeSchema = z.object({
  items: itemsSchema,
  /** Граммовка по размерам: по одному набору на каждый размер продукта */
  sizes: z.array(z.object({ optionId: z.string().min(1), items: itemsSchema })).max(10).optional(),
});

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
    include: {
      recipe: { include: { items: { include: { ingredient: true } }, sizeItems: true } },
      modifiers: { include: { options: { orderBy: [{ priceDelta: "asc" }, { name: "asc" }] } } },
    },
  });
  if (!p) return null;
  const base = (p.recipe?.items ?? []).map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) }));
  const sizeMod = findSizeModifier(p.modifiers);
  // у каждого размера своя граммовка; пока она не задана, показываем прежнюю: основной рецепт × коэффициент размера
  const sizes = sizeMod ? sizeMod.options.map((o) => {
    const own = (p.recipe?.sizeItems ?? []).filter((r) => r.optionId === o.id);
    const items = own.length
      ? own.map((r) => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) }))
      : base.map((i) => ({ ingredientId: i.ingredientId, quantity: Math.round(i.quantity * Number(o.recipeMultiplier) * 1000) / 1000 }));
    return { id: o.id, name: o.name, priceDelta: Number(o.priceDelta), items };
  }) : null;
  return { product: { id: p.id, name: p.name, price: Number(p.price) }, items: base, sizeName: sizeMod?.name ?? null, sizes };
}

export async function saveRecipe(productId: string, input: unknown, userId: string) {
  const parsed = recipeSchema.parse(input);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { recipe: { include: { items: true, sizeItems: true } }, modifiers: { include: { options: { orderBy: [{ priceDelta: "asc" }, { name: "asc" }] } } } },
  });
  if (!product) throw new ApiError(404, "Продукт не найден");
  const sizeMod = findSizeModifier(product.modifiers);

  // продукт с размерами: у каждого размера своя граммовка; основной рецепт = первый (по умолчанию выбранный) размер
  let sizes: { optionId: string; items: { ingredientId: string; quantity: number }[] }[] | null = null;
  if (sizeMod && parsed.sizes) {
    const ids = sizeMod.options.map((o) => o.id);
    const got = parsed.sizes.map((s) => s.optionId);
    if (got.length !== ids.length || ids.some((id) => !got.includes(id))) throw new ApiError(400, "Укажите граммовку для каждого размера");
    sizes = ids.map((id) => parsed.sizes!.find((s) => s.optionId === id)!);
  }
  const items = sizes ? sizes[0].items : parsed.items;
  const allIds = [...new Set([...items, ...(sizes?.flatMap((s) => s.items) ?? [])].map((i) => i.ingredientId))];
  const found = await prisma.ingredient.count({ where: { id: { in: allIds } } });
  if (found !== allIds.length) throw new ApiError(400, "Один из ингредиентов не найден");

  const oldItems = (product.recipe?.items ?? []).map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) }));
  await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.upsert({ where: { productId }, create: { productId }, update: {} });
    await tx.recipeItem.deleteMany({ where: { recipeId: recipe.id } });
    await tx.recipeItem.createMany({ data: items.map((i) => ({ recipeId: recipe.id, ingredientId: i.ingredientId, quantity: i.quantity })) });
    await tx.recipeSizeItem.deleteMany({ where: { recipeId: recipe.id } });
    if (sizes) await tx.recipeSizeItem.createMany({ data: sizes.flatMap((s) => s.items.map((i) => ({ recipeId: recipe.id, optionId: s.optionId, ingredientId: i.ingredientId, quantity: i.quantity }))) });
  });
  await audit({
    userId, action: "RECIPE_CHANGED", entity: "Recipe", entityId: productId,
    oldValue: { items: oldItems, sizes: (product.recipe?.sizeItems ?? []).length },
    newValue: { items, ...(sizes ? { sizes: sizes.map((s) => ({ size: sizeMod!.options.find((o) => o.id === s.optionId)?.name, items: s.items })) } : {}) },
  });
}
