import { FilterForm } from "@/components/admin/FilterForm";
import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { listOrders, activeBoard, type OrderFilters } from "@/services/orders";
import { ActionButton } from "@/components/admin/ActionButton";
import { advanceOrderAction, confirmPaymentAction } from "./actions";
import { money, dateTimeStr } from "@/lib/format";
import { STATUS_LABEL, STATUS_CLS, NEXT, SOURCE_LABEL, METHOD_LABEL, PAY_LABEL, PAY_CLS, FULFILL_LABEL } from "@/lib/order-status";

type SP = Record<string, string | undefined>;
const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm";
const COLS = ["NEW", "CONFIRMED", "PREPARING", "READY"] as const;

function qs(sp: SP, patch: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await pageGuard("orders.view");
  const sp = await searchParams;
  const { locationId } = await getScope();
  const manage = can(user.role, "orders.manage");
  const board = sp.view === "board";

  if (board) {
    const cards = await activeBoard(locationId);
    return (
      <div className="space-y-5">
        <Header sp={sp} board />
        <div className="grid gap-4 lg:grid-cols-4">
          {COLS.map((c) => {
            const list = cards.filter((o) => o.status === c);
            return (
              <div key={c} className="space-y-3 rounded-2xl bg-neutral-100/70 p-3">
                <p className="flex items-center justify-between text-sm font-semibold"><span>{STATUS_LABEL[c]}</span><span className="rounded bg-white px-2 py-0.5 text-xs">{list.length}</span></p>
                {list.length === 0 && <p className="py-4 text-center text-xs text-neutral-400">Пусто</p>}
                {list.map((o) => (
                  <div key={o.id} className={`space-y-2 rounded-xl bg-white p-3 text-sm shadow-sm ${o.delayed ? "ring-2 ring-red-300" : ""}`}>
                    <div className="flex items-center justify-between">
                      <Link href={`/admin/orders/${o.id}`} className="font-bold text-green-800 underline">№{o.number}</Link>
                      <span className={`text-xs ${o.delayed ? "font-semibold text-red-700" : "text-neutral-500"}`}>{o.ageMin} мин</span>
                    </div>
                    <p className="text-neutral-700">{o.summary}</p>
                    {o.scheduledFor && <p className="inline-block rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">К {dateTimeStr(o.scheduledFor)}</p>}
                    {o.note && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">«{o.note}»</p>}
                    <p className="text-xs text-neutral-500">{SOURCE_LABEL[o.source]} · {FULFILL_LABEL[o.fulfillment]}{o.customer && ` · ${o.customer}`}</p>
                    <p className="flex items-center justify-between"><b>{money(o.total)}</b>
                      {o.payment && <span className={`rounded px-2 py-0.5 text-xs ${PAY_CLS[o.payment.status]}`}>{METHOD_LABEL[o.payment.method]} · {PAY_LABEL[o.payment.status]}</span>}</p>
                    {manage && o.status === "NEW" && o.payment?.method === "ONLINE" && o.payment.status === "PENDING" && (
                      <ActionButton action={confirmPaymentAction} fields={{ id: o.id }} label="Подтвердить оплату" />
                    )}
                    {manage && NEXT[o.status] && !(o.status === "NEW" && o.payment?.method === "ONLINE" && o.payment.status === "PENDING") && (
                      <ActionButton action={advanceOrderAction} fields={{ id: o.id, to: NEXT[o.status]!.to, back: "/admin/orders?view=board" }} label={NEXT[o.status]!.label} />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const filters: OrderFilters = { status: sp.status, source: sp.source, method: sp.method, from: sp.from, to: sp.to, q: sp.q, page: Number(sp.page) || 1 };
  const r = await listOrders(locationId, filters);
  return (
    <div className="space-y-5">
      <Header sp={sp} />
      <FilterForm key={JSON.stringify(sp)} className="flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={sp.q} placeholder="№ заказа, клиент, телефон" className={`${input} min-w-52`} />
        <select name="status" defaultValue={sp.status ?? "all"} className={input}>
          <option value="all">Все статусы</option><option value="active">Активные</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="source" defaultValue={sp.source ?? ""} className={input}><option value="">Все источники</option><option value="WEB">Сайт</option><option value="POS">Касса</option></select>
        <select name="method" defaultValue={sp.method ?? ""} className={input}><option value="">Любая оплата</option>{Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <label className="text-xs text-neutral-500">с<input type="date" name="from" defaultValue={sp.from} className={`${input} ml-1`} /></label>
        <label className="text-xs text-neutral-500">по<input type="date" name="to" defaultValue={sp.to} className={`${input} ml-1`} /></label>
        <button className="rounded-lg bg-white px-4 py-2 text-sm shadow-sm hover:bg-neutral-50">Применить</button>
        <Link href="/admin/orders" className="px-2 py-2 text-sm text-neutral-500 underline">Сбросить</Link>
      </FilterForm>
      <div className="flex flex-wrap gap-6 rounded-2xl bg-white px-5 py-3 text-sm shadow-sm">
        <span>Найдено: <b>{r.count}</b></span>
        <span>Завершено: <b>{r.stats.completed}</b></span>
        <span>Выручка по ним: <b>{money(r.stats.revenue)}</b></span>
        <span>Отменено: <b>{r.stats.cancelled}</b></span>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">№</th><th>Время</th><th>Источник</th><th>Клиент</th><th>Состав</th><th className="text-right">Сумма</th><th>Оплата</th><th className="p-3">Статус</th></tr></thead>
          <tbody>
            {r.rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-neutral-500">Заказов не найдено</td></tr>}
            {r.rows.map((o) => (
              <tr key={o.id} className="border-t border-neutral-100 align-top">
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-green-800 underline">{o.number}</Link></td>
                <td className="whitespace-nowrap">{dateTimeStr(o.createdAt)}</td>
                <td>{SOURCE_LABEL[o.source]}<span className="block text-xs text-neutral-500">{FULFILL_LABEL[o.fulfillment]}</span></td>
                <td className="max-w-48 truncate">{o.customer ?? "—"}</td>
                <td className="max-w-64 truncate text-neutral-600">{o.summary}</td>
                <td className="whitespace-nowrap text-right">{money(o.total)}</td>
                <td>{o.payment ? <span className={`rounded px-2 py-0.5 text-xs ${PAY_CLS[o.payment.status]}`}>{METHOD_LABEL[o.payment.method]} · {PAY_LABEL[o.payment.status]}</span> : "—"}</td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[o.status]}`}>{STATUS_LABEL[o.status]}</span>{o.delayed && <span className="ml-1 text-xs font-semibold text-red-700">задержка</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {r.page > 1 && <Link href={`/admin/orders${qs(sp, { page: String(r.page - 1) })}`} className="rounded-lg bg-white px-4 py-2 shadow-sm">← Назад</Link>}
          <span>Страница {r.page} из {r.pages}</span>
          {r.page < r.pages && <Link href={`/admin/orders${qs(sp, { page: String(r.page + 1) })}`} className="rounded-lg bg-white px-4 py-2 shadow-sm">Дальше →</Link>}
        </div>
      )}
    </div>
  );
}

function Header({ sp, board }: { sp: SP; board?: boolean }) {
  void sp;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Заказы</h1>
      <div className="flex gap-1 rounded-xl bg-white p-1 text-sm shadow-sm">
        <Link href="/admin/orders" className={`rounded-lg px-4 py-1.5 ${!board ? "bg-green-700 text-white" : "hover:bg-neutral-50"}`}>Список</Link>
        <Link href="/admin/orders?view=board" className={`rounded-lg px-4 py-1.5 ${board ? "bg-green-700 text-white" : "hover:bg-neutral-50"}`}>Доска</Link>
      </div>
    </div>
  );
}
