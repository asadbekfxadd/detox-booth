import Link from "next/link";
import { getScope } from "@/lib/location";
import { listVariances } from "@/services/inventory";
import { money, qty, unitLabel, dateTimeStr } from "@/lib/format";

export default async function VariancePage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const { locationId } = await getScope();
  const rows = await listVariances(locationId);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory Variance</h1>
        <Link href="/admin/inventory" className="text-sm text-green-800 underline">← К складу</Link>
      </div>
      <p className="text-sm text-neutral-500">Расхождение = факт − то, что ожидала система. Минус означает недостачу.</p>
      {sp.ok === "count" && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">Пересчёт сохранён, остатки обновлены</p>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Дата</th><th>Точка</th><th>Ингредиент</th><th className="text-right">Ожидалось</th><th className="text-right">Факт</th><th className="text-right">Расхождение</th><th className="text-right">В деньгах</th><th className="p-3">Кто</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-neutral-500">Инвентаризаций ещё не было</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="p-3">{dateTimeStr(r.date)}</td><td>{r.location}</td><td className="font-medium">{r.ingredient}</td>
                <td className="text-right">{qty(r.expected)} {unitLabel(r.unit)}</td><td className="text-right">{qty(r.actual)} {unitLabel(r.unit)}</td>
                <td className={`text-right font-semibold ${r.variance < 0 ? "text-red-700" : r.variance > 0 ? "text-green-700" : ""}`}>{r.variance > 0 ? "+" : ""}{qty(r.variance)} {unitLabel(r.unit)}</td>
                <td className={`text-right ${r.cost < 0 ? "text-red-700" : ""}`}>{money(r.cost)}</td><td className="p-3">{r.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
