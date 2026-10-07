import { prisma } from "@/lib/prisma";
import { pageGuard, formLocations } from "@/lib/guard";
import { PurchaseForm } from "@/components/admin/PurchaseForm";
import { createPurchaseAction } from "../actions";

export default async function NewPurchasePage() {
  await pageGuard("purchases.manage");
  const { options, defaultId } = await formLocations();
  const [suppliers, ings] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">Новая закупка</h1>
      <PurchaseForm action={createPurchaseAction} suppliers={suppliers} locations={options} defaultLocationId={defaultId}
        ingredients={ings.map((i) => ({ id: i.id, name: i.name, unit: i.unit, avgCost: Number(i.avgCost) }))} />
    </div>
  );
}
