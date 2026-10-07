import { FilterForm } from "@/components/admin/FilterForm";
import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { getScope } from "@/lib/location";
import { listPurchases } from "@/services/purchases";
import { money, dateStr } from "@/lib/format";
import { STATUS_LABEL, STATUS_CLS } from "@/lib/purchase-status";


export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageGuard("purchases.manage");
  const sp = await searchParams;
  const { locationId } = await getScope();
  const rows = await listPurchases(locationId, sp.status);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Закупки</h1>
        <div className="flex gap-2">
          <Link href="/admin/suppliers" className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50">Поставщики</Link>
          <Link href="/admin/purchases/new" className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Новая закупка</Link>
        </div>
      </div>
      <FilterForm key={JSON.stringify(sp)} className="flex gap-2">
        <select name="status" defaultValue={sp.status ?? "all"} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
          <option value="all">Все статусы</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="rounded-lg bg-white px-4 py-2 text-sm shadow-sm hover:bg-neutral-50">Фильтр</button>
      </FilterForm>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Дата</th><th>Поставщик</th><th>Точка</th><th className="text-right">Позиций</th><th className="text-right">Сумма</th><th>Статус</th><th className="p-3" /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-neutral-500">Закупок нет</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100">
                <td className="p-3">{dateStr(p.createdAt)}</td><td className="font-medium">{p.supplier}</td><td>{p.location}</td>
                <td className="text-right">{p.items}</td><td className="text-right">{money(p.total)}</td>
                <td><span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                <td className="p-3 text-right"><Link href={`/admin/purchases/${p.id}`} className="text-green-800 underline">Открыть</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
