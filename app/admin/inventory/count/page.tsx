import { prisma } from "@/lib/prisma";
import { pageGuard, formLocations } from "@/lib/guard";
import { FormShell, LocationField, fieldClass } from "@/components/admin/ops";
import { qty, unitLabel } from "@/lib/format";
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
      <p className="text-sm text-neutral-500">Введите фактический остаток там, где пересчитали, в единицах из колонки (г, мл, шт). Пустые строки пропускаются. Чтобы пересчитать другую точку, переключите её вверху.</p>
      {!locationId && <p className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-900">Выбраны «все точки», поэтому пересчёт идёт для первой точки из списка. Выберите нужную точку в переключателе слева.</p>}
      <FormShell action={countAction} submitLabel="Сохранить пересчёт" cancelHref="/admin/inventory">
        <div className="max-w-sm"><LocationField options={only} defaultValue={defaultId} /></div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="py-1">Ингредиент</th><th className="text-right">По системе</th><th className="pl-6">Факт</th></tr></thead>
          <tbody>
            {ingredients.map((i) => (
              <tr key={i.id} className="border-t border-neutral-100">
                <td className="py-2 font-medium">{i.name}</td>
                <td className="text-right">{qty(st.get(i.id) ?? 0)} {unitLabel(i.unit)}</td>
                <td className="pl-6"><div className="flex items-center gap-2"><input name={`actual_${i.id}`} type="number" min="0" step="any" placeholder="—" className={`${fieldClass} w-32`} /><span className="text-neutral-500">{unitLabel(i.unit)}</span></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </FormShell>
    </div>
  );
}
