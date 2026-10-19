import { prisma } from "@/lib/prisma";
import { pageGuard, formLocations } from "@/lib/guard";
import { FormShell, LocationField } from "@/components/admin/ops";
import { fmtStock } from "@/lib/ingredient-units";
import { CountInput } from "@/components/admin/CountInput";
import { countAction } from "../actions";

export default async function CountPage() {
  await pageGuard("inventory.edit");
  const { options, defaultId, locationId } = await formLocations();
  const only = options.filter((o) => o.id === defaultId);
  const [ingredients, stocks] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockItem.findMany({ where: { locationId: defaultId } }),
  ]);
  const st = new Map(stocks.map((s) => [s.ingredientId, Number(s.quantity)]));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Инвентаризация</h1>
      <p className="text-sm text-neutral-500">Введите фактический остаток там, где пересчитали, в кг, л или штуках (дробные через запятую: 2,5 кг). Пустые строки пропускаются. Чтобы пересчитать другую точку, переключите её вверху.</p>
      {!locationId && <p className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-900">Выбраны «все точки», поэтому пересчёт идёт для первой точки из списка. Выберите нужную точку в переключателе слева.</p>}
      <FormShell action={countAction} submitLabel="Сохранить пересчёт" cancelHref="/admin/inventory">
        <div className="max-w-sm"><LocationField options={only} defaultValue={defaultId} /></div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="py-1">Ингредиент</th><th className="text-right">По системе</th><th className="pl-6">Факт</th></tr></thead>
          <tbody>
            {ingredients.map((i) => (
              <tr key={i.id} className="border-t border-neutral-100">
                <td className="py-2 font-medium">{i.name}</td>
                <td className="text-right">{fmtStock(i.unit, st.get(i.id) ?? 0)}</td>
                <td className="pl-6"><CountInput ingredientId={i.id} unit={i.unit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </FormShell>
    </div>
  );
}
