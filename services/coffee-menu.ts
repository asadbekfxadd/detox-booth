import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { matchIngredient } from "@/lib/product-draft";
import { COFFEE, COFFEE_CATEGORY, COFFEE_INGREDIENTS, MILK_MODIFIER, SUGAR_MODIFIER } from "@/lib/coffee-menu";
import { createCategory } from "@/services/categories";
import { createIngredient } from "@/services/ingredients";
import { createProduct } from "@/services/products";
import { saveRecipe } from "@/services/recipes";

export type CoffeeResult = { created: string[]; skipped: string[]; newIngredients: string[] };

/**
 * Добавляет категорию «Кофе», 10 позиций с размерами, рецептами и выбором молока. Повторный запуск безопасен:
 * позиции с тем же названием пропускаются, существующие ингредиенты (кофе, молоко…) берутся со склада, а не создаются заново.
 */
export async function addCoffeeMenu(userId: string): Promise<CoffeeResult> {
  let category = await prisma.category.findFirst({ where: { name: { equals: COFFEE_CATEGORY, mode: "insensitive" } } });
  if (!category) {
    const max = await prisma.category.aggregate({ _max: { sort: true } });
    await createCategory({ name: COFFEE_CATEGORY, sort: (max._max.sort ?? 0) + 1 }, userId);
    category = await prisma.category.findFirstOrThrow({ where: { name: { equals: COFFEE_CATEGORY, mode: "insensitive" } } });
  }

  const stock = await prisma.ingredient.findMany({ select: { id: true, name: true } });
  const ids = new Map<string, string>();
  const newIngredients: string[] = [];
  for (const ing of COFFEE_INGREDIENTS) {
    const hit = matchIngredient(ing.name, stock);
    if (hit) { ids.set(ing.key, hit.id); continue; }
    const made = await createIngredient({ name: ing.name, category: ing.category, unit: ing.unit, price: "0", minStock: "0", shelfLifeDays: null, supplierId: null }, userId);
    ids.set(ing.key, made.id);
    stock.push({ id: made.id, name: made.name });
    newIngredients.push(made.name);
  }

  const created: string[] = [];
  const skipped: string[] = [];
  for (const c of COFFEE) {
    if (await prisma.product.findFirst({ where: { name: { equals: c.name, mode: "insensitive" } }, select: { id: true } })) { skipped.push(c.name); continue; }
    const first = [...c.sizes].sort((a, b) => a.price - b.price)[0];
    const product = await createProduct({ name: c.name, description: c.description, categoryId: category.id, price: first.price, image: c.photo, prepMinutes: c.prep, allergens: c.allergens, isAvailable: true }, userId);
    try {
      await saveRecipe(product.id, {
        sizes: c.sizes.map((s) => ({ optionId: null, name: s.name, price: s.price, items: s.items.map((i) => ({ ingredientId: ids.get(i.ing)!, quantity: i.qty })) })),
      }, userId);
      for (const m of [...(c.milk ? [MILK_MODIFIER] : []), SUGAR_MODIFIER]) {
        await prisma.modifier.create({ data: { productId: product.id, name: m.name, multiple: false, required: m.name === "Молоко", options: { create: m.options.map(([name, priceDelta]) => ({ name, priceDelta, recipeMultiplier: 1 })) } } });
      }
    } catch (e) {
      await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
      throw e;
    }
    created.push(c.name);
  }
  await audit({ userId, action: "PRODUCT_CREATED", entity: "Product", newValue: { via: "кофейное меню", created, skipped, newIngredients } });
  return { created, skipped, newIngredients };
}
