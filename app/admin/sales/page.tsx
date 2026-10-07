import { pageGuard } from "@/lib/guard";
import { getScope } from "@/lib/location";
import { getSales } from "@/services/sales";
import { parseRange } from "@/services/dashboard";
import { RangeBar } from "@/components/admin/RangeBar";
import { money, num, pct } from "@/lib/format";

type SP = { range?: string; from?: string; to?: string };
const Kpi = ({ l, v }: { l: string; v: string }) => <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-neutral-500">{l}</p><p className="mt-1 text-xl font-bold">{v}</p></div>;

export default async function SalesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard("orders.view");
  const sp = await searchParams;
  const { locationId } = await getScope();
  const range = parseRange(sp);
  const s = await getSales(range, locationId);
  const q = new URLSearchParams({ report: "sales", range: range.key, ...(range.key === "custom" ? { from: sp.from ?? "", to: sp.to ?? "" } : {}) }).toString();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Продажи</h1>
        <a href={`/api/finance/export?${q}`} className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50">Скачать CSV</a>
      </div>
      <RangeBar base="/admin/sales" range={range} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi l="Выручка" v={money(s.revenue)} /><Kpi l="Заказов" v={num(s.orders)} /><Kpi l="Средний чек" v={money(s.avgCheck)} />
        <Kpi l="Скидки и баллы" v={money(s.discount)} /><Kpi l="Касса / сайт" v={`${s.sources.POS.orders} / ${s.sources.WEB.orders}`} />
      </div>
      <p className="text-xs text-neutral-500">Учитываются завершённые заказы. Возвращённые и отменённые в продажи не входят.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2"><h2 className="font-bold">По дням</h2>
          <div className="max-h-[32rem] overflow-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="text-left text-neutral-500"><th className="p-3">Дата</th><th className="text-right">Заказов</th><th className="text-right">Выручка</th><th className="text-right">Ср. чек</th><th className="pr-3 text-right">Скидки</th></tr></thead>
              <tbody>{s.byDay.map((d) => (
                <tr key={d.date} className="border-t border-neutral-100"><td className="p-3">{d.date}</td><td className="text-right">{d.orders}</td><td className="text-right font-semibold">{money(d.revenue)}</td><td className="text-right">{d.orders ? money(d.avg) : "—"}</td><td className="pr-3 text-right text-neutral-500">{d.discount ? money(d.discount) : "—"}</td></tr>
              ))}</tbody>
            </table>
          </div></section>
        <section className="space-y-2"><h2 className="font-bold">По продуктам</h2>
          <div className="max-h-[32rem] overflow-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="text-left text-neutral-500"><th className="p-3">Продукт</th><th>Категория</th><th className="text-right">Шт.</th><th className="text-right">Выручка</th><th className="pr-3 text-right">Доля</th></tr></thead>
              <tbody>
                {s.products.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-neutral-500">Продаж за период нет</td></tr>}
                {s.products.map((p) => <tr key={p.name} className="border-t border-neutral-100"><td className="p-3 font-semibold">{p.name}</td><td className="text-neutral-500">{p.category}</td><td className="text-right">{p.qty}</td><td className="text-right">{money(p.revenue)}</td><td className="pr-3 text-right">{pct(p.share)}</td></tr>)}
              </tbody>
            </table>
          </div></section>
      </div>
    </div>
  );
}
