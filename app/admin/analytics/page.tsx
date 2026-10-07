import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { getScope } from "@/lib/location";
import { getAnalytics, type MenuClass } from "@/services/analytics";
import { parseRange } from "@/services/dashboard";
import { RangeBar } from "@/components/admin/RangeBar";
import { CountBars } from "@/components/admin/charts2";
import { money, num, pct } from "@/lib/format";

type SP = { range?: string; from?: string; to?: string };
const CLS: Record<MenuClass, [string, string, string]> = {
  STAR: ["⭐ Звезда", "bg-lime-100 text-green-900", "Популярно и выгодно — держите и продвигайте"],
  PLOWHORSE: ["🐴 Рабочая лошадка", "bg-amber-100 text-amber-900", "Популярно, но маржа ниже средней — проверьте цену или рецепт"],
  PUZZLE: ["❓ Загадка", "bg-blue-100 text-blue-900", "Выгодно, но продаётся мало — продвигайте"],
  DOG: ["🐶 Аутсайдер", "bg-red-100 text-red-800", "Мало продаж и низкая маржа — пересмотрите или уберите"],
};
const ABC_CLS: Record<string, string> = { A: "bg-lime-100 text-green-900", B: "bg-amber-100 text-amber-900", C: "bg-neutral-100 text-neutral-700" };
const Kpi = ({ l, v, sub, bad }: { l: string; v: string; sub?: string; bad?: boolean }) => <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-neutral-500">{l}</p><p className={`mt-1 text-xl font-bold ${bad ? "text-red-700" : ""}`}>{v}</p>{sub && <p className="text-xs text-neutral-500">{sub}</p>}</div>;
const Card = ({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) => <section className="min-w-0 overflow-x-auto rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-semibold">{title}</h2>{note && <p className="mb-3 text-xs text-neutral-500">{note}</p>}<div className={note ? "" : "mt-3"}>{children}</div></section>;
const th = "p-2 text-left font-medium text-neutral-500";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard("dashboard.view");
  const sp = await searchParams;
  const { locationId } = await getScope();
  const range = parseRange(sp);
  const a = await getAnalytics(range, locationId);
  const payTotal = a.payments.CASH + a.payments.CARD + a.payments.ONLINE;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Аналитика</h1>
      <RangeBar base="/admin/analytics" range={range} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi l="Выручка" v={money(a.revenue)} /><Kpi l="Заказов" v={num(a.orders)} /><Kpi l="Средний чек" v={money(a.avgCheck)} />
        <Kpi l="Отмены" v={`${a.cancelled} (${pct(a.cancelRate)})`} sub="от всех заказов за период" bad={a.cancelRate > 10} />
        <Kpi l="Возвраты" v={money(a.refunds)} sub={`${a.refundCount} шт.`} bad={a.refundCount > 0} />
        <Kpi l="Повторные покупатели" v={pct(a.customers.repeatRate)} sub={`${a.customers.buyers} покупателей`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Заказы по часам"><CountBars data={a.hours} xKey="label" /></Card>
        <Card title="Заказы по дням недели"><CountBars data={a.weekdays} xKey="label" /></Card>
      </div>

      <Card title="Меню: популярность и маржа" note="Маржа на единицу = средняя цена продажи − себестоимость по рецепту (текущая средняя цена ингредиентов). Допы в себестоимость не входят. Показаны только продукты с рецептом.">
        {a.menu.length === 0 ? <p className="text-sm text-neutral-500">Нет данных: за период не было продаж продуктов с рецептом.</p> : (
          <>
            <p className="mb-2 text-sm text-neutral-600">Средняя маржа на единицу (с учётом продаж): <b>{money(a.avgMargin)}</b></p>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr><th className={th}>Продукт</th><th className={`${th} text-right`}>Продано</th><th className={`${th} text-right`}>Цена</th><th className={`${th} text-right`}>Себестоимость</th><th className={`${th} text-right`}>Маржа</th><th className={th}>Класс</th></tr></thead>
              <tbody>{a.menu.map((m) => (
                <tr key={m.id} className="border-t border-neutral-100">
                  <td className="p-2 font-semibold">{m.name}</td><td className="text-right">{m.qty}</td><td className="text-right">{money(m.avgPrice)}</td><td className="text-right">{money(m.cost)}</td>
                  <td className="text-right">{money(m.margin)} <span className="text-xs text-neutral-500">({pct(m.marginPct)})</span></td>
                  <td className="p-2"><span title={CLS[m.cls][2]} className={`whitespace-nowrap rounded px-2 py-0.5 text-xs ${CLS[m.cls][1]}`}>{CLS[m.cls][0]}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
            <ul className="mt-3 grid gap-1 text-xs text-neutral-600 sm:grid-cols-2">{(Object.keys(CLS) as MenuClass[]).map((k) => <li key={k}><b>{CLS[k][0]}:</b> {CLS[k][2]}</li>)}</ul>
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ABC-анализ по выручке" note="A — продукты, дающие первые 80% выручки, B — следующие 15%, C — остальное.">
          {a.abc.length === 0 ? <p className="text-sm text-neutral-500">Продаж за период нет.</p> : (
            <table className="w-full text-sm"><thead><tr><th className={th}>Продукт</th><th className={`${th} text-right`}>Выручка</th><th className={`${th} text-right`}>Доля</th><th className={`${th} text-right`}>Накоплено</th><th className={th}>Кл.</th></tr></thead>
              <tbody>{a.abc.map((p) => <tr key={p.id} className="border-t border-neutral-100"><td className="p-2">{p.name}</td><td className="text-right">{money(p.revenue)}</td><td className="text-right">{pct(p.share)}</td><td className="text-right">{pct(p.cum)}</td><td className="p-2"><span className={`rounded px-2 py-0.5 text-xs font-bold ${ABC_CLS[p.abc]}`}>{p.abc}</span></td></tr>)}</tbody></table>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Каналы продаж">
            {a.channels.length === 0 ? <p className="text-sm text-neutral-500">Продаж за период нет.</p> : (
              <ul className="space-y-1 text-sm">{a.channels.map((c) => <li key={c.label} className="flex justify-between"><span>{c.label} <span className="text-neutral-400">· {c.orders}</span></span><b>{money(c.revenue)}</b></li>)}</ul>
            )}
            <div className="mt-3 border-t pt-3 text-sm"><p className="mb-1 font-semibold">Способы оплаты</p>
              {([["Наличные", a.payments.CASH], ["Карта", a.payments.CARD], ["Онлайн", a.payments.ONLINE]] as const).map(([l, v]) => <p key={l} className="flex justify-between"><span>{l}</span><span><b>{money(v)}</b> <span className="text-xs text-neutral-500">{payTotal ? pct((v / payTotal) * 100) : "—"}</span></span></p>)}
            </div>
          </Card>
          <Card title="Скидки и промокоды">
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between"><span>Всего скидок и баллов</span><b>{money(a.promo.discountTotal)}</b></li>
              <li className="flex justify-between"><span>Доля от оборота до скидок</span><b>{pct(a.promo.discountShare)}</b></li>
              <li className="flex justify-between"><span>Заказов с промокодом</span><b>{a.promo.orders}</b></li>
              <li className="flex justify-between"><span>Скидок по промокодам</span><b>{money(a.promo.discount)}</b></li>
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Клиенты">
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between"><span>Покупателей с заказами</span><b>{a.customers.buyers}</b></li>
            <li className="flex justify-between"><span>Новых (зарегистрированы в периоде)</span><b>{a.customers.newBuyers}</b></li>
            <li className="flex justify-between"><span>Вернувшихся</span><b>{a.customers.returning}</b></li>
            <li className="flex justify-between"><span>Сделали 2+ заказа</span><b>{pct(a.customers.repeatRate)}</b></li>
          </ul>
          {a.customers.top.length > 0 && (
            <div className="mt-4"><p className="mb-1 text-sm font-semibold">Лучшие клиенты периода</p>
              <ul className="space-y-1 text-sm">{a.customers.top.map((c) => <li key={c.id} className="flex justify-between"><Link href={`/admin/customers/${c.id}`} className="text-green-800 underline">{c.name}</Link><span>{c.orders} зак. · <b>{money(c.spent)}</b></span></li>)}</ul></div>
          )}
        </Card>
        <Card title="Списания">
          {a.writeOffs.byReason.length === 0 ? <p className="text-sm text-neutral-500">Списаний за период не было.</p> : (
            <>
              <ul className="space-y-1 text-sm">{a.writeOffs.byReason.map((w) => <li key={w.reason} className="flex justify-between"><span>{w.reason} <span className="text-neutral-400">· {w.count}</span></span><b>{money(w.cost)}</b></li>)}</ul>
              <p className="mb-1 mt-3 text-sm font-semibold">Больше всего потерь по ингредиентам</p>
              <ul className="space-y-1 text-sm">{a.writeOffs.topIngredients.map((w) => <li key={w.name} className="flex justify-between"><span>{w.name}</span><b>{money(w.cost)}</b></li>)}</ul>
            </>
          )}
        </Card>
      </div>

      {a.locations.length > 0 && (
        <Card title="Сравнение точек">
          <table className="w-full text-sm"><thead><tr><th className={th}>Точка</th><th className={`${th} text-right`}>Заказов</th><th className={`${th} text-right`}>Выручка</th><th className={`${th} text-right`}>Ср. чек</th><th className={`${th} text-right`}>Валовая маржа</th></tr></thead>
            <tbody>{a.locations.map((l) => <tr key={l.name} className="border-t border-neutral-100"><td className="p-2 font-semibold">{l.name}</td><td className="text-right">{l.orders}</td><td className="text-right">{money(l.revenue)}</td><td className="text-right">{l.orders ? money(l.avgCheck) : "—"}</td><td className="text-right">{l.orders ? pct(l.margin) : "—"}</td></tr>)}</tbody></table>
        </Card>
      )}
    </div>
  );
}
