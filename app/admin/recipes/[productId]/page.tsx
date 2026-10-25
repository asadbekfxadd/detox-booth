import Link from "next/link";
import { notFound } from "next/navigation";
import { currentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { getRecipe } from "@/services/recipes";
import { RecipeEditor } from "@/components/admin/RecipeEditor";
import { saveRecipeAction } from "../actions";

export default async function RecipePage({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<{ created?: string }> }) {
  const { productId } = await params;
  const { created } = await searchParams;
  const user = (await currentSession())!.user;
  const showCost = can(user.role, "products.cost");
  const { locationId } = await getScope();
  const [recipe, ingredients, stocks] = await Promise.all([
    getRecipe(productId),
    prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockItem.findMany({ where: locationId ? { locationId } : {} }),
  ]);
  const stock = new Map<string, number>();
  for (const s of stocks) stock.set(s.ingredientId, (stock.get(s.ingredientId) ?? 0) + Number(s.quantity));
  if (!recipe) notFound();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Рецепт: {recipe.product.name}</h1>
        <p className="text-sm text-neutral-500">Здесь можно поменять всё: название, размеры и цены, граммы и цены ингредиентов. Остатки показаны по выбранной точке.</p>
      </div>
      {created && <p className="rounded-xl bg-lime-100 px-4 py-3 text-sm text-green-900">Продукт создан и добавлен в меню. Проверьте граммы и впишите цену ингредиентов, чтобы посчитать себестоимость. Фото добавьте в <Link href={`/admin/products/${productId}`} className="underline">карточке продукта</Link>.</p>}
      <RecipeEditor
        key={`${recipe.product.id}-${recipe.sizes?.map((x) => x.id).join(",") ?? ""}`}
        product={recipe.product}
        initial={recipe.items}
        sizes={recipe.sizes}
        action={saveRecipeAction.bind(null, productId)}
        ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, cost: showCost ? Number(i.avgCost) : null, stock: stock.get(i.id) ?? 0 }))}
      />
    </div>
  );
}
