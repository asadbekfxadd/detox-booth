import { notFound } from "next/navigation";
import { currentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { getRecipe } from "@/services/recipes";
import { RecipeEditor } from "@/components/admin/RecipeEditor";
import { saveRecipeAction } from "../actions";

export default async function RecipePage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
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
        <p className="text-sm text-neutral-500">Остатки показаны по выбранной точке.</p>
      </div>
      <RecipeEditor
        price={recipe.product.price}
        initial={recipe.items}
        action={saveRecipeAction.bind(null, productId)}
        ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, cost: showCost ? Number(i.avgCost) : null, stock: stock.get(i.id) ?? 0 }))}
      />
    </div>
  );
}
