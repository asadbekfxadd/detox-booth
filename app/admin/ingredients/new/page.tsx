import { pageGuard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { categorySuggestions } from "@/services/ingredients";
import { IngredientForm } from "@/components/admin/IngredientForm";
import { createIngredientAction } from "../actions";

export default async function NewIngredientPage() {
  await pageGuard("inventory.edit");
  const [categories, suppliers] = await Promise.all([categorySuggestions(), prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Новый ингредиент</h1>
      <IngredientForm action={createIngredientAction} submitLabel="Добавить" categories={categories} suppliers={suppliers} />
    </div>
  );
}
