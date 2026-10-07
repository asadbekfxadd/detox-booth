import Link from "next/link";
import { getScope } from "@/lib/location";
import { listBatches } from "@/services/inventory";
import { money, qty, unitLabel, dateStr } from "@/lib/format";

const BADGE = { expired: "bg-red-100 text-red-700", soon: "bg-amber-100 text-amber-800", ok: "bg-lime-100 text-green-900" } as const;
const LABEL = { expired: "Просрочено", soon: "Скоро истекает", ok: "OK" } as const;

export default async function BatchesPage() {
  const { locationId } = await getScope();
  const rows = await listBatches(locationId);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Партии и сроки годности</h1>
        <Link href="/admin/inventory" className="text-sm text-green-800 underline">← К складу</Link>
      </div>
      <p className="text-sm text-neutral-500">Отсортировано по сроку: так списываются ингредиенты при продаже (FEFO).</p>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Партия</th><th>Ингредиент</th><th>Точка</th><th className="text-right">Остаток</th><th className="text-right">Цена/ед.</th><th>Получена</th><th>Срок</th><th className="p-3">Статус</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-neutral-500">Партий нет</td></tr>}
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-neutral-100">
                <td className="p-3 text-neutral-500">{b.code}</td><td className="font-medium">{b.ingredient}</td><td>{b.location}</td>
                <td className="text-right">{qty(b.quantity)} {unitLabel(b.unit)}</td><td className="text-right">{money(b.unitCost)} / {unitLabel(b.unit)}</td>
                <td>{dateStr(b.receivedAt)}</td><td>{b.expiresAt ? dateStr(b.expiresAt) : "—"}</td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs ${BADGE[b.status as keyof typeof BADGE]}`}>{LABEL[b.status as keyof typeof LABEL]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
