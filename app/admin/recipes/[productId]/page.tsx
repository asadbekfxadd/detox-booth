import { notFound } from "next/navigation";
import { currentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getRecipe } from "@/services/recipes";
import { RecipeEditor } from "@/components/admin/RecipeEditor";
import { saveRecipeAction } from "../actions";

export default async function RecipePage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const user = (await currentSession())!.user;
  const showCost = can(user.role, "products.cost");
  const [recipe, ingredients] = await Promise.all([
    getRecipe(productId),
    prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  if (!recipe) notFound();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Рецепт: {recipe.product.name}</h1>
      <RecipeEditor
        price={recipe.product.price}
        initial={recipe.items}
        action={saveRecipeAction.bind(null, productId)}
        ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, cost: showCost ? Number(i.avgCost) : null }))}
      />
    </div>
  );
}
