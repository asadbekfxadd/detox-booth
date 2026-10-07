import Link from "next/link";
import { getScope } from "@/lib/location";
import { getDashboard, parseRange } from "@/services/dashboard";
import { money, num, pct } from "@/lib/format";
import { RevenueProfitChart, OrdersChart, HBarChart } from "@/components/admin/charts";

type SP = { range?: string; from?: string; to?: string };

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "bad" }) {
  const c = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-neutral-900";
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${c}`}>{value}</p>
    </div>
  );
}
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>
);

export default async function Dashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { locationId } = await getScope();
  const range = parseRange(sp);
  const d = await getDashboard(range, locationId);
  const tabs: [string, string][] = [["today", "Сегодня"], ["7", "7 дней"], ["30", "30 дней"]];
  const iso = (x: Date) => new Date(x.getTime() + 5 * 3600000).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-2xl font-bold">Обзор</h1>
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/admin/dashboard?range=${k}`}
            className={`rounded-full px-4 py-1.5 text-sm ${range.key === k ? "bg-green-700 text-white" : "bg-white text-neutral-700 hover:bg-neutral-100"}`}>{l}</Link>
        ))}
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="range" value="custom" />
          <input type="date" name="from" defaultValue={iso(range.from)} className="rounded-lg border border-neutral-200 bg-white px-2 py-1" />
          <input type="date" name="to" defaultValue={iso(new Date(range.to.getTime() - 1))} className="rounded-lg border border-neutral-200 bg-white px-2 py-1" />
          <button className={`rounded-full px-4 py-1.5 ${range.key === "custom" ? "bg-green-700 text-white" : "bg-white hover:bg-neutral-100"}`}>Свой период</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Выручка" value={money(d.revenue)} />
        <Kpi label="Заказы" value={num(d.orders)} />
        <Kpi label="Средний чек" value={money(d.avgCheck)} />
        <Kpi label="Валовая прибыль" value={money(d.profit)} />
        <Kpi label="Валовая маржа" value={pct(d.margin)} />
        <Kpi label="Доля себестоимости" value={pct(d.foodCost)} />
        <Kpi label="Заканчивается" value={num(d.lowStock.length)} tone={d.lowStock.length ? "bad" : undefined} />
        <Kpi label="Write-offs" value={money(d.writeOffs)} tone={d.writeOffs ? "warn" : undefined} />
        <Kpi label="Новые клиенты" value={num(d.newCustomers)} />
        <Kpi label="Повторные клиенты" value={num(d.returningCustomers)} />
        <Kpi label="Скоро истекает срок" value={num(d.expiringSoon)} tone={d.expiringSoon ? "warn" : undefined} />
        <Kpi label="Просрочено" value={num(d.expired)} tone={d.expired ? "bad" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Выручка и прибыль по дням"><RevenueProfitChart data={d.byDay} /></Card>
        <Card title="Заказы по дням"><OrdersChart data={d.byDay} /></Card>
        <Card title="Продажи по категориям"><HBarChart data={d.byCategory} dataKey="revenue" nameKey="name" /></Card>
        <Card title="Топ продуктов"><HBarChart data={d.topProducts} dataKey="revenue" nameKey="name" /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="⚠️ Заканчивается на складе">
          {d.lowStock.length === 0 ? <p className="text-sm text-neutral-500">Всё в норме.</p> : (
            <ul className="space-y-1 text-sm">
              {d.lowStock.map((s, i) => (
                <li key={i} className="flex justify-between"><span>{s.name} <span className="text-neutral-400">· {s.location}</span></span>
                  <span className="font-semibold text-red-700">{num(s.qty)} / min {num(s.min)} {s.unit}</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Уведомления">
          {d.notifications.length === 0 ? <p className="text-sm text-neutral-500">Нет уведомлений.</p> : (
            <ul className="space-y-1 text-sm">{d.notifications.map((n) => <li key={n.id}>{n.message}</li>)}</ul>
          )}
        </Card>
      </div>

      {d.byLocation.length > 0 && (
        <Card title="Сравнение точек">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="py-1">Точка</th><th>Заказы</th><th className="text-right">Выручка</th></tr></thead>
            <tbody>{d.byLocation.map((l) => (
              <tr key={l.name} className="border-t border-neutral-100"><td className="py-2">{l.name}</td><td>{num(l.orders)}</td><td className="text-right">{money(l.revenue)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
