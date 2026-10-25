import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard, formLocations } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPrep, prepIngredientOptions } from "@/services/prep";
import { PrepEditor } from "@/components/admin/PrepEditor";
import { ProduceForm } from "@/components/admin/ProduceForm";
import { ActionButton } from "@/components/admin/ActionButton";
import { savePrepAction, producePrepAction, deletePrepAction } from "../actions";

export default async function PrepCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await pageGuard("inventory.view");
  const { locationId, options: locations, defaultId } = await formLocations();
  const [prep, options] = await Promise.all([getPrep(id, locationId), prepIngredientOptions()]);
  if (!prep) notFound();
  const used = (await prisma.productionAct.count({ where: { ingredientId: id } })) + (await prisma.stockItem.count({ where: { ingredientId: id } })) + (await prisma.recipeItem.count({ where: { ingredientId: id } })) > 0;
  const showCost = can(user.role, "products.cost");
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Заготовка: {prep.name}</h1>
        <Link href="/admin/prep" className="text-sm text-green-800 underline">← Все заготовки</Link>
      </div>
      {sp.ok === "saved" && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">Рецепт заготовки сохранён</p>}
      {can(user.role, "inventory.edit") && <ProduceForm action={producePrepAction} prep={prep} locations={locations} defaultLocationId={defaultId} showCost={showCost} />}
      {can(user.role, "recipes.edit") && (
        <>
          <h2 className="text-lg font-semibold">Рецепт заготовки</h2>
          <PrepEditor action={savePrepAction} options={options} showCost={showCost}
            initial={{ id: prep.id, name: prep.name, unit: prep.unit, outputQty: prep.outputQty, shelfLifeDays: prep.shelfLifeDays, items: prep.items.map((i) => ({ ingredientId: i.ingredientId, quantity: i.quantity })), locked: used }} />
          <p className="text-sm text-neutral-600">Заготовку можно добавлять в рецепты напитков: <Link href="/admin/recipes" className="text-green-800 underline">Рецепты</Link>. Остаток и сроки видны в <Link href="/admin/inventory" className="text-green-800 underline">складе</Link>.</p>
          <ActionButton action={deletePrepAction} fields={{ id: prep.id }} label="Удалить рецепт заготовки" danger confirmText="Удалить рецепт заготовки? Остаток на складе останется как обычный продукт." />
        </>
      )}
    </div>
  );
}
