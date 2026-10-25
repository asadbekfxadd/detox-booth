import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { getScope } from "@/lib/location";
import { parseRange } from "@/services/dashboard";
import { getStaffReport } from "@/services/reports";
import { listVoidedItems } from "@/services/void-item";
import { dateTimeStr } from "@/lib/format";
import { RangeBar } from "@/components/admin/RangeBar";
import { money, pct } from "@/lib/format";

type SP = { range?: string; from?: string; to?: string };
const ROLE = { cashier: "Кассир", waiter: "Официант", none: "" } as const;
const th = "p-2 text-left font-medium text-neutral-500";

export default async function StaffReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard("dashboard.view");
  const sp = await searchParams;
  const { locationId } = await getScope();
  const range = parseRange(sp);
  const [rows, voids] = await Promise.all([getStaffReport(range, locationId), listVoidedItems(range.from, range.to, locationId)]);
  const hot = (r: { discountPct: number }) => r.discountPct > 15;
  return (
    <div className="space-y-6">
      <div><Link href="/admin/analytics" className="text-sm text-green-800 underline">← Аналитика</Link><h1 className="text-2xl font-bold">Продажи по сотрудникам</h1></div>
      <RangeBar base="/admin/analytics/staff" range={range} />
      <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs text-neutral-500">Продажа засчитывается тому, кто принял заказ. Если официант принял заказ, а кассир закрыл счёт, заказ виден у обоих — у каждого со своей ролью, поэтому строки не складываются в общую выручку. Скидка считается от суммы до скидок. Много отмен и возвратов у одного человека — повод поговорить.</p>
        {rows.length === 0 ? <p className="text-sm text-neutral-500">За период не было заказов.</p> : (
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Сотрудник</th><th className={th}>Роль</th><th className={`${th} text-right`}>Заказов</th><th className={`${th} text-right`}>Выручка</th><th className={`${th} text-right`}>Средний чек</th><th className={`${th} text-right`}>Скидки</th><th className={`${th} text-right`}>Чаевые</th><th className={`${th} text-right`}>Отмены</th><th className={`${th} text-right`}>Возвраты</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.key} className="border-t border-neutral-100">
                <td className="p-2 font-semibold">{r.name}</td><td className="p-2">{ROLE[r.role]}</td>
                <td className="p-2 text-right">{r.orders}</td><td className="p-2 text-right">{money(r.revenue)}</td><td className="p-2 text-right">{r.orders ? money(r.avgCheck) : "—"}</td>
                <td className={`p-2 text-right ${hot(r) ? "font-semibold text-red-700" : ""}`}>{money(r.discount)} <span className="text-xs text-neutral-500">({pct(r.discountPct)})</span></td>
                <td className="p-2 text-right">{money(r.tips)}</td>
                <td className="p-2 text-right">{r.cancelled}</td>
                <td className={`p-2 text-right ${r.refunded > 0 ? "text-red-700" : ""}`}>{r.refunded ? `${r.refunded} · ${money(r.refundedSum)}` : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Отменённые позиции</h2>
        <p className="mb-3 text-xs text-neutral-500">Блюда, убранные из заказа стола. «После кухни» значит, что заказ уже был отправлен и продукты списаны, а отмену подтвердил менеджер.</p>
        {voids.length === 0 ? <p className="text-sm text-neutral-500">За период позиции не отменяли.</p> : (
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Когда</th><th className={th}>Заказ</th><th className={th}>Блюдо</th><th className={`${th} text-right`}>Сумма</th><th className={th}>Причина</th><th className={th}>Кто отменил</th><th className={th}>Подтвердил</th></tr></thead>
            <tbody>{voids.map((v) => (
              <tr key={v.id} className="border-t border-neutral-100">
                <td className="p-2 whitespace-nowrap">{dateTimeStr(v.at)}</td><td className="p-2">№{v.orderNumber}</td>
                <td className="p-2 font-semibold">{v.quantity} × {v.name}{v.afterKitchen && <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-normal text-red-800">после кухни</span>}</td>
                <td className="p-2 text-right">{money(v.sum)}</td><td className="p-2">{v.reason}</td><td className="p-2">{v.by}</td><td className="p-2">{v.approvedBy ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
