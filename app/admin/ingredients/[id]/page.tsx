import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { getIngredient, categorySuggestions } from "@/services/ingredients";
import { IngredientForm } from "@/components/admin/IngredientForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { fmtQty, portionsFrom } from "@/lib/ingredient-units";
import { updateIngredientAction, deleteIngredientAction } from "../actions";

export default async function IngredientPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("inventory.edit");
  const { id } = await params;
  const [ing, categories, suppliers] = await Promise.all([
    getIngredient(id), categorySuggestions(), prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!ing) notFound();
  const total = ing.stocks.reduce((a, s) => a + s.quantity, 0);
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{ing.name}</h1>
        <p className="text-sm text-neutral-500">{ing.sku} · на складе: <b className="text-neutral-800">{fmtQty(ing.unit, total)}</b>
          {" "}· <Link href="/admin/inventory/receive" className="text-green-800 underline">Оформить приход</Link></p>
      </div>
      <IngredientForm
        action={updateIngredientAction} submitLabel="Сохранить" categories={categories} suppliers={suppliers}
        defaults={{ id: ing.id, name: ing.name, category: ing.category, unit: ing.unit, price: ing.price, minStock: ing.minStock, shelfLifeDays: ing.shelfLifeDays, supplierId: ing.supplierId, locked: ing.locked }}
      />
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="mb-2 text-sm font-semibold">Используется в рецептах ({ing.usedIn.length})</p>
        {ing.usedIn.length === 0
          ? <p className="text-sm text-neutral-600">Пока ни в одном. Добавьте его в рецепт продукта: <Link href="/admin/recipes" className="text-green-800 underline">Рецепты</Link>.</p>
          : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {ing.usedIn.map((u) => (
                <li key={u.productId} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/recipes/${u.productId}`} className="font-medium text-green-800 underline">{u.name}</Link>
                  <span className="text-neutral-600">{fmtQty(ing.unit, u.quantity)} на порцию · хватит на {portionsFrom(total, u.quantity)}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
      <ActionButton action={deleteIngredientAction} fields={{ id: ing.id }} label="Удалить ингредиент" danger confirmText="Удалить ингредиент? Это действие нельзя отменить." />
    </div>
  );
}
