import { prisma } from "@/lib/prisma";
import { pageGuard, formLocations } from "@/lib/guard";
import { BulkReceiveForm } from "@/components/admin/BulkReceiveForm";
import { stockInManyAction } from "../actions";

export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ ing?: string }> }) {
  await pageGuard("inventory.edit");
  const { ing } = await searchParams;
  const { options, defaultId } = await formLocations();
  const ingredients = (await prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, avgCost: true } }))
    .map((i) => ({ ...i, avgCost: Number(i.avgCost) }));
  const categories = [...new Set((await prisma.ingredient.findMany({ select: { category: true }, orderBy: { category: "asc" } })).map((i) => i.category))];
  return (
    <div className="max-w-6xl space-y-5">
      <div><h1 className="text-2xl font-bold">Приход товара</h1><p className="text-sm text-neutral-500">Вся поставка одним списком: добавляйте строки или вставьте накладную целиком. Нового продукта нет в списке? Создайте его прямо в строке и продолжайте.</p></div>
      <BulkReceiveForm action={stockInManyAction} ingredients={ingredients} categories={categories} locations={options} defaultLocationId={defaultId} initialIngredientId={ing} />
    </div>
  );
}
