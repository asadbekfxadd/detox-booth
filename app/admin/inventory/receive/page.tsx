import { prisma } from "@/lib/prisma";
import { pageGuard, formLocations } from "@/lib/guard";
import { BulkReceiveForm } from "@/components/admin/BulkReceiveForm";
import { stockInManyAction } from "../actions";

export default async function ReceivePage() {
  await pageGuard("inventory.edit");
  const { options, defaultId } = await formLocations();
  const ingredients = (await prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, avgCost: true } }))
    .map((i) => ({ ...i, avgCost: Number(i.avgCost) }));
  return (
    <div className="max-w-6xl space-y-5">
      <div><h1 className="text-2xl font-bold">Приход товара</h1><p className="text-sm text-neutral-500">Вся поставка одним списком: добавляйте строки или вставьте накладную целиком.</p></div>
      <BulkReceiveForm action={stockInManyAction} ingredients={ingredients} locations={options} defaultLocationId={defaultId} />
    </div>
  );
}
