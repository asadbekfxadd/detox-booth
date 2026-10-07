import { money, dateTimeStr } from "@/lib/format";
import type { shiftSummary } from "@/services/pos";

type S = NonNullable<Awaited<ReturnType<typeof shiftSummary>>>;
const Row = ({ k, v, bold, cls }: { k: string; v: string; bold?: boolean; cls?: string }) => (
  <div className={`flex justify-between border-t border-neutral-100 py-2 text-sm ${bold ? "font-bold" : ""} ${cls ?? ""}`}><span className="text-neutral-600">{k}</span><span>{v}</span></div>
);

export function ShiftSummaryView({ s }: { s: S }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold">Смена · {s.location}</h2>
          <span className={`rounded px-2 py-0.5 text-xs ${s.status === "OPEN" ? "bg-lime-100 text-green-900" : "bg-neutral-100 text-neutral-700"}`}>{s.status === "OPEN" ? "Открыта" : "Закрыта"}</span>
        </div>
        <Row k="Кассир" v={s.cashier} />
        <Row k="Открыта" v={dateTimeStr(s.openedAt)} />
        {s.closedAt && <Row k="Закрыта" v={dateTimeStr(s.closedAt)} />}
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-2 font-bold">Продажи</h3>
        <Row k="Заказов" v={String(s.sales.count)} />
        <Row k="Выручка" v={money(s.sales.total)} bold />
        <Row k="Наличные" v={money(s.sales.cash)} />
        <Row k="Карта" v={money(s.sales.card)} />
        <Row k="Онлайн / перевод" v={money(s.sales.online)} />
        <Row k="Скидки" v={money(s.sales.discount)} />
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-2 font-bold">Возвраты</h3>
        <Row k="Возвращённых заказов" v={String(s.refunds.count)} />
        <Row k="Сумма возвратов" v={money(s.refunds.total)} />
        <Row k="Из них наличными" v={money(s.refunds.cash)} />
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-2 font-bold">Касса (наличные)</h3>
        <Row k="На начало смены" v={money(s.opening)} />
        <Row k="+ наличные продажи" v={money(s.sales.cash)} />
        <Row k="− наличные возвраты" v={money(s.refunds.cash)} />
        <Row k="Ожидается в кассе" v={money(s.expectedCash)} bold />
        {s.closing != null && <Row k="Фактически" v={money(s.closing)} bold />}
        {s.difference != null && (
          <Row k="Расхождение" v={`${s.difference > 0 ? "+" : ""}${money(s.difference)}`} bold cls={s.difference < 0 ? "text-red-700" : s.difference > 0 ? "text-amber-700" : "text-green-700"} />
        )}
      </div>
    </div>
  );
}
