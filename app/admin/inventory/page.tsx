import Link from "next/link";
import { currentSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { getStockOverview } from "@/services/inventory";
import { money, qty, unitLabel, dateStr } from "@/lib/format";

const OK: Record<string, string> = { stockin: "Приход оформлен", transfer: "Перемещение выполнено" };
const btn = "rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const user = (await currentSession())!.user;
  const { locationId } = await getScope();
  const rows = await getStockOverview(locationId);
  const edit = can(user.role, "inventory.edit");
  const showCost = can(user.role, "products.cost");
  const now = Date.now();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Склад</h1>
        <div className="flex flex-wrap gap-2">
          {edit && <Link href="/admin/inventory/receive" className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Приход</Link>}
          {edit && <Link href="/admin/inventory/transfer" className={btn}>Перемещение</Link>}
          {edit && <Link href="/admin/inventory/count" className={btn}>Инвентаризация</Link>}
          <Link href="/admin/inventory/batches" className={btn}>Партии и сроки</Link>
          <Link href="/admin/inventory/variance" className={btn}>Расхождения</Link>
          <Link href="/admin/writeoffs" className={btn}>Списания</Link>
        </div>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500">
            <th className="p-3">SKU</th><th>Ингредиент</th><th>Категория</th><th className="text-right">Остаток</th>
            <th className="text-right">Min / Max (на точку)</th><th>Статус</th><th>Ближайший срок</th>
            {showCost && <th className="text-right">Ср. цена за ед.</th>}<th className="p-3">Поставщик</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const exp = r.nearestExpiry;
              const expCls = !exp ? "" : exp.getTime() < now ? "font-semibold text-red-700" : exp.getTime() < now + 3 * 86400000 ? "text-amber-700" : "";
              return (
                <tr key={r.id} className="border-t border-neutral-100 align-top">
                  <td className="p-3 text-neutral-500">{r.sku}</td>
                  <td className="font-medium">{r.name}</td>
                  <td>{r.category}</td>
                  <td className="text-right">
                    <b>{qty(r.total)}</b> {unitLabel(r.unit)}
                    {r.perLocation && <div className="text-xs text-neutral-500">{r.perLocation.map((p) => <div key={p.name} className={p.low ? "text-red-700" : ""}>{p.name}: {qty(p.qty)}</div>)}</div>}
                  </td>
                  <td className="text-right text-neutral-500">{qty(r.min)} / {qty(r.max)} {unitLabel(r.unit)}</td>
                  <td>{r.low ? <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">⚠️ LOW STOCK</span> : <span className="rounded bg-lime-100 px-2 py-0.5 text-xs text-green-900">OK</span>}</td>
                  <td className={expCls}>{exp ? dateStr(exp) : "—"}</td>
                  {showCost && <td className="text-right">{money(r.cost)} / {unitLabel(r.unit)}</td>}
                  <td className="p-3">{r.supplier ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
