import { prisma } from "@/lib/prisma";
import { getScope } from "@/lib/location";
import { formLocations } from "@/lib/guard";
import { listWriteOffs } from "@/services/inventory";
import { FormShell, Field, LocationField, fieldClass } from "@/components/admin/ops";
import { IngredientQty } from "@/components/admin/IngredientQty";
import { money, qty, unitLabel, dateTimeStr } from "@/lib/format";
import { writeOffAction } from "./actions";

const REASONS: [string, string][] = [["EXPIRED", "Expired"], ["SPOILED", "Spoiled"], ["DAMAGED", "Damaged"], ["PRODUCTION_WASTE", "Production Waste"], ["EMPLOYEE_ERROR", "Employee Error"], ["OTHER", "Other"]];

export default async function WriteOffsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const { locationId } = await getScope();
  const { options, defaultId } = await formLocations();
  const [rows, ingredients] = await Promise.all([
    listWriteOffs(locationId),
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
  ]);
  const total = rows.reduce((a, r) => a + r.cost, 0);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Списания</h1>
      {sp.ok && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">Списание оформлено, остаток уменьшен</p>}
      <FormShell action={writeOffAction} submitLabel="Списать" cancelHref="/admin/writeoffs">
        <div className="grid gap-4 md:grid-cols-2">
          <LocationField options={options} defaultValue={defaultId} />
          <Field label="Причина">
            <select name="reason" required defaultValue="" className={fieldClass}>
              <option value="" disabled>Выберите…</option>
              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>
        <IngredientQty ingredients={ingredients} />
      </FormShell>
      <p className="text-sm text-neutral-500">Последние списания: {rows.length} · на сумму <b>{money(total)}</b></p>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Дата</th><th>Точка</th><th>Ингредиент</th><th className="text-right">Кол-во</th><th>Причина</th><th className="text-right">Стоимость</th><th className="p-3">Сотрудник</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-neutral-500">Списаний нет</td></tr>}
            {rows.map((w) => (
              <tr key={w.id} className="border-t border-neutral-100">
                <td className="p-3">{dateTimeStr(w.date)}</td><td>{w.location}</td><td className="font-medium">{w.ingredient}</td>
                <td className="text-right">{qty(w.quantity)} {unitLabel(w.unit)}</td><td>{w.reason.replace("_", " ")}</td>
                <td className="text-right">{money(w.cost)}</td><td className="p-3">{w.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
