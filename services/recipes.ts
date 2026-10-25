import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { findSizeModifier, mlOf } from "@/lib/recipe-size";
import { Prisma } from "@prisma/client";
import { toBase } from "@/lib/ingredient-units";
import { grossQty, netUnitCost } from "@/lib/yield";

const itemsSchema = z.array(z.object({
  ingredientId: z.string().min(1, "Выберите ингредиент"),
  quantity: z.coerce.number({ error: "Укажите количество" }).positive("Количество должно быть больше 0").max(1_000_000, "Слишком большое количество"),
})).min(1, "Добавьте хотя бы один ингредиент").max(40, "Слишком много ингредиентов")
  .refine((v) => new Set(v.map((i) => i.ingredientId)).size === v.length, { message: "Один ингредиент указан дважды" });

const sizeSchema = z.object({
  /** Существующий размер; нет значения: новый */
  optionId: z.string().min(1).nullish(),
  name: z.string().trim().min(1, "Название размера не может быть пустым").max(40, "Название размера слишком длинное"),
  price: z.coerce.number({ error: "Укажите цену размера" }).min(0, "Цена не может быть отрицательной").max(1_000_000_000, "Слишком большая цена"),
  items: itemsSchema,
});

export const recipeSchema = z.object({
  /** Ингредиенты на порцию: для продукта без размеров */
  items: itemsSchema.optional(),
  /** Размеры: у каждого своё название, цена и граммовка. Один размер: размеров как таковых нет. */
  sizes: z.array(sizeSchema).min(1, "Нужен хотя бы один размер").max(10, "Слишком много размеров").optional(),
  /** Новое название и цена продукта (цена нужна у продукта без размеров; с размерами цена берётся из размера) */
  name: z.string().trim().min(2, "Название: минимум 2 символа").max(80, "Название слишком длинное").optional(),
  price: z.coerce.number({ error: "Укажите цену" }).min(0, "Цена не может быть отрицательной").max(1_000_000_000, "Слишком большая цена").optional(),
  /** Цены ингредиентов за 1 кг/л/шт, вписанные прямо в рецепте (только тем, кто видит себестоимость) */
  prices: z.array(z.object({ ingredientId: z.string().min(1), price: z.coerce.number({ error: "Укажите цену" }).min(0, "Цена не может быть отрицательной").max(1_000_000_000, "Слишком большая цена") })).max(60).optional(),
  /** Выход годного (брутто → нетто), %, вписанный прямо в рецепте */
  yields: z.array(z.object({ ingredientId: z.string().min(1), yieldPct: z.coerce.number({ error: "Укажите выход" }).min(1, "Выход от 1 до 100 %").max(100, "Выход от 1 до 100 %") })).max(60).optional(),
}).refine((v) => v.items || v.sizes, { message: "Добавьте хотя бы один ингредиент" });

/** Список продуктов с рецептом, себестоимостью и числом порций, которые можно приготовить из остатков. */
export async function listRecipes(locationId: string | null, withCost: boolean) {
  const [products, stocks] = await Promise.all([
    prisma.product.findMany({
      where: { isArchived: false },
      include: { category: true, recipe: { include: { items: { include: { ingredient: true } } } }, modifiers: { include: { options: { orderBy: [{ priceDelta: "asc" }, { name: "asc" }] } } } },
      orderBy: [{ category: { sort: "asc" } }, { name: "asc" }],
    }),
    prisma.stockItem.findMany({ where: locationId ? { locationId } : {} }),
  ]);
  const stock = new Map<string, number>();
  for (const s of stocks) stock.set(s.ingredientId, (stock.get(s.ingredientId) ?? 0) + Number(s.quantity));

  return products.map((p) => {
    const items = p.recipe?.items ?? [];
    const cost = items.reduce((a, i) => a + Number(i.quantity) * netUnitCost(Number(i.ingredient.avgCost), i.ingredient.yieldPct), 0);
    const portions = items.length
      ? Math.max(0, Math.min(...items.map((i) => Math.floor((stock.get(i.ingredientId) ?? 0) / grossQty(Number(i.quantity), i.ingredient.yieldPct)))))
      : null;
    return {
      id: p.id, name: p.name, category: p.category.name, price: Number(p.price),
      sizes: findSizeModifier(p.modifiers)?.options.map((o) => o.name) ?? [],
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
    return { id: o.id, name: o.name, price: Math.round((Number(p.price) + Number(o.priceDelta)) * 100) / 100, items };
  }) : null;
  return { product: { id: p.id, name: p.name, price: Number(p.price), volumeMl: p.volumeMl }, items: base, sizeName: sizeMod?.name ?? null, sizes };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function saveRecipe(productId: string, input: unknown, userId: string) {
  const parsed = recipeSchema.parse(input);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { recipe: { include: { items: true, sizeItems: true } }, modifiers: { include: { options: { orderBy: [{ priceDelta: "asc" }, { name: "asc" }] } } } },
  });
  if (!product) throw new ApiError(404, "Продукт не найден");
  const sizeMod = findSizeModifier(product.modifiers, 1);

  // размеры по возрастанию цены: самый дешёвый = размер по умолчанию = основной рецепт и цена продукта
  const sizes = parsed.sizes ? parsed.sizes.map((s, idx) => ({ ...s, idx })).sort((a, b) => a.price - b.price || a.idx - b.idx) : null;
  if (sizes) {
    const names = sizes.map((s) => s.name.toLowerCase());
    if (new Set(names).size !== names.length) throw new ApiError(400, "Названия размеров не должны повторяться");
    const own = new Set((sizeMod?.options ?? []).map((o) => o.id));
    const used = sizes.map((s) => s.optionId).filter((x): x is string => !!x);
    if (used.some((id) => !own.has(id))) throw new ApiError(409, "Размеры уже изменили в другом окне. Обновите страницу и повторите.");
    if (new Set(used).size !== used.length) throw new ApiError(400, "Размер указан дважды");
  }
  const multi = !!sizes && sizes.length >= 2;
  const items = sizes ? sizes[0].items : parsed.items!;
  const newName = parsed.name && parsed.name !== product.name ? parsed.name : null;
  if (newName) {
    const dup = await prisma.product.findFirst({ where: { id: { not: productId }, name: { equals: newName, mode: "insensitive" } } });
    if (dup) throw new ApiError(400, "Продукт с таким названием уже есть");
  }
  const newPrice = sizes ? sizes[0].price : parsed.price;
  const allIds = [...new Set([...items, ...(multi ? sizes!.flatMap((s) => s.items) : [])].map((i) => i.ingredientId))];
  const found = await prisma.ingredient.count({ where: { id: { in: allIds } } });
  if (found !== allIds.length) throw new ApiError(400, "Один из ингредиентов не найден");

  // цены ингредиентов, вписанные в рецепте
  const priceEdits = parsed.prices ?? [];
  const ingRows = priceEdits.length ? await prisma.ingredient.findMany({ where: { id: { in: priceEdits.map((p) => p.ingredientId) } } }) : [];
  if (ingRows.length !== new Set(priceEdits.map((p) => p.ingredientId)).size) throw new ApiError(400, "Один из ингредиентов не найден");

  const yieldEdits = parsed.yields ?? [];
  const yieldRows = yieldEdits.length ? await prisma.ingredient.findMany({ where: { id: { in: yieldEdits.map((y) => y.ingredientId) } } }) : [];
  if (yieldRows.length !== new Set(yieldEdits.map((y) => y.ingredientId)).size) throw new ApiError(400, "Один из ингредиентов не найден");

  const oldItems = (product.recipe?.items ?? []).map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) }));
  const optionIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    if (multi) {
      const modifierId = sizeMod?.id ?? (await tx.modifier.create({ data: { productId, name: "Объём", required: true, multiple: false } })).id;
      const keep = sizes!.map((s) => s.optionId).filter((x): x is string => !!x);
      await tx.modifierOption.deleteMany({ where: { modifierId, ...(keep.length ? { id: { notIn: keep } } : {}) } });
      const min = sizes![0].price;
      for (const s of sizes!) {
        const data = { name: s.name, priceDelta: new Prisma.Decimal(r2(s.price - min)) };
        if (s.optionId) { await tx.modifierOption.update({ where: { id: s.optionId }, data }); optionIds.push(s.optionId); }
        else optionIds.push((await tx.modifierOption.create({ data: { modifierId, ...data } })).id);
      }
    } else if (sizeMod && sizes) {
      await tx.modifier.delete({ where: { id: sizeMod.id } }); // остался один размер: выбирать нечего
    }
    const volume = sizes ? mlOf(sizes[0].name) : null;
    const patch = { ...(newName ? { name: newName } : {}), ...(newPrice !== undefined ? { price: new Prisma.Decimal(r2(newPrice)) } : {}), ...(volume ? { volumeMl: volume } : {}) };
    if (Object.keys(patch).length) await tx.product.update({ where: { id: productId }, data: patch });
    const recipe = await tx.recipe.upsert({ where: { productId }, create: { productId }, update: {} });
    await tx.recipeItem.deleteMany({ where: { recipeId: recipe.id } });
    await tx.recipeItem.createMany({ data: items.map((i) => ({ recipeId: recipe.id, ingredientId: i.ingredientId, quantity: i.quantity })) });
    await tx.recipeSizeItem.deleteMany({ where: { recipeId: recipe.id } });
    if (multi) await tx.recipeSizeItem.createMany({ data: sizes!.flatMap((s, i) => s.items.map((it) => ({ recipeId: recipe.id, optionId: optionIds[i], ingredientId: it.ingredientId, quantity: it.quantity }))) });
    for (const pe of priceEdits) {
      const ing = ingRows.find((i) => i.id === pe.ingredientId)!;
      const avg = new Prisma.Decimal(pe.price / toBase(ing.unit, 1)).toDecimalPlaces(2);
      if (!avg.equals(ing.avgCost)) await tx.ingredient.update({ where: { id: ing.id }, data: { avgCost: avg } });
    }
    for (const y of yieldEdits) {
      const ing = yieldRows.find((i) => i.id === y.ingredientId)!;
      const next = new Prisma.Decimal(y.yieldPct).toDecimalPlaces(2);
      if (!next.equals(ing.yieldPct)) await tx.ingredient.update({ where: { id: ing.id }, data: { yieldPct: next } });
    }
  });
  for (const y of yieldEdits) {
    const ing = yieldRows.find((i) => i.id === y.ingredientId)!;
    if (Math.abs(Number(ing.yieldPct) - y.yieldPct) > 0.005) await audit({ userId, action: "INGREDIENT_UPDATED", entity: "Ingredient", entityId: ing.id, oldValue: { yieldPct: Number(ing.yieldPct) }, newValue: { yieldPct: y.yieldPct, via: "рецепт" } });
  }
  for (const pe of priceEdits) {
    const ing = ingRows.find((i) => i.id === pe.ingredientId)!;
    const old = Number(ing.avgCost) * toBase(ing.unit, 1);
    if (Math.abs(old - pe.price) > 0.005) await audit({ userId, action: "INGREDIENT_UPDATED", entity: "Ingredient", entityId: ing.id, oldValue: { price: Math.round(old * 100) / 100 }, newValue: { price: pe.price, via: "рецепт" } });
  }
  if (newName || (newPrice !== undefined && Number(product.price) !== r2(newPrice)))
    await audit({ userId, action: "PRODUCT_UPDATED", entity: "Product", entityId: productId, oldValue: { name: product.name, price: Number(product.price) }, newValue: { name: newName ?? product.name, price: newPrice ?? Number(product.price), via: "рецепт" } });
  await audit({
    userId, action: "RECIPE_CHANGED", entity: "Recipe", entityId: productId,
    oldValue: { items: oldItems, sizes: (product.recipe?.sizeItems ?? []).length },
    newValue: { items, ...(multi ? { sizes: sizes!.map((s) => ({ size: s.name, price: s.price, items: s.items })) } : {}) },
  });
}
