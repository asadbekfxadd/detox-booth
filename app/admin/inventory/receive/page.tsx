import { prisma } from "@/lib/prisma";
import { pageGuard, formLocations } from "@/lib/guard";
import { BulkReceiveForm } from "@/components/admin/BulkReceiveForm";
import { stockInManyAction } from "../actions";

export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ ing?: string }> }) {
  await pageGuard("inventory.edit");
  const { ing } = await searchParams;
  const { options, defaultId } = await formLocations();
  // цена последней закупки: подставляется в строку прихода (партии инвентаризации не в счёт: у них цена просто средняя)
  const [list, lastBatches] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, avgCost: true } }),
    prisma.batch.findMany({ where: { NOT: { code: { contains: "-CNT-" } } }, distinct: ["ingredientId"], orderBy: [{ ingredientId: "asc" }, { receivedAt: "desc" }], select: { ingredientId: true, unitCost: true } }),
  ]);
  const last = new Map(lastBatches.map((b) => [b.ingredientId, Number(b.unitCost)]));
  const ingredients = list.map((i) => ({ ...i, avgCost: Number(i.avgCost), lastCost: last.get(i.id) ?? null }));
  const categories = [...new Set((await prisma.ingredient.findMany({ select: { category: true }, orderBy: { category: "asc" } })).map((i) => i.category))];
  return (
    <div className="max-w-6xl space-y-5">
      <div><h1 className="text-2xl font-bold">Приход товара</h1><p className="text-sm text-neutral-500">Вся поставка одним списком в кг, л и штуках: добавляйте строки или вставьте накладную целиком. Нового продукта нет в списке? Создайте его прямо в строке и продолжайте.</p></div>
      <BulkReceiveForm action={stockInManyAction} ingredients={ingredients} categories={categories} locations={options} defaultLocationId={defaultId} initialIngredientId={ing} />
    </div>
  );
}
