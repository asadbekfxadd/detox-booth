import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { getOpenShift } from "@/services/pos";
import { getStaffTable } from "@/services/tables";
import { STATUS_LABEL, STATUS_CLS } from "@/lib/order-status";
import { sum, dateTimeStr } from "@/lib/format";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { serveOrderAction, voidItemAction } from "../actions";
import { VoidItemForm } from "@/components/pos/VoidItemForm";
import { needsManagerApproval } from "@/lib/void-item";
import { can } from "@/lib/rbac";
import { BillPayForm } from "@/components/pos/BillPayForm";
import { unpaidOrders } from "@/lib/table-bill";

export const dynamic = "force-dynamic";

export default async function PosTablePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; paid?: string; tip?: string }> }) {
  const user = await pageGuard("pos.use");
  const [{ id }, { error, paid, tip }] = await Promise.all([params, searchParams]);
  const [data, shift] = await Promise.all([getStaffTable(id, user), getOpenShift(user.id)]);
  if (!data) notFound();
  const { table, bill, orders, total, due, feePct } = data;
  const live = orders.filter((o) => o.status !== "CANCELLED");
  const toPay = unpaidOrders(orders).map((o) => ({ id: o.id, number: o.number, total: o.total, status: o.status, summary: o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ") }));

  return (
    <main className="min-h-screen bg-[#f7f3ea] p-4">
      <AutoRefresh active everyMs={8000} />
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center gap-3">
          <Link href="/pos/tables" className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">← Все столы</Link>
          <h1 className="text-2xl font-bold">Стол {table.number}</h1>
          {bill && live.length > 0 && <a href={`/print/bill/${bill.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Печать счёта</a>}
          {bill?.requested && <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold text-white">Просит счёт</span>}
        </header>
        {paid != null && <p role="status" className="rounded-xl bg-lime-100 px-4 py-3 font-semibold text-green-900">Принято: {sum(Number(paid) || 0)}{Number(tip) > 0 && ` + чаевые ${sum(Number(tip))}`}. За столом остались неоплаченные заказы.</p>}
        {error && <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}

        {live.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-neutral-600">{bill ? "Все заказы отменены. Закройте счёт в админке или дождитесь новых заказов." : "Стол свободен. Заказы появятся, когда гость отсканирует QR и отправит заказ."}</p>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id} className={`space-y-2 rounded-2xl bg-white p-4 shadow-sm ${o.status === "CANCELLED" ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">№{o.number} <span className="text-sm font-normal text-neutral-500">{dateTimeStr(o.createdAt)}</span></p>
                  <span className="flex items-center gap-1">{o.paid && <span className="rounded bg-lime-100 px-2 py-0.5 text-xs font-semibold text-green-900">Оплачен</span>}<span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[o.status] ?? ""}`}>{STATUS_LABEL[o.status] ?? o.status}</span></span>
                </div>
                <ul className="space-y-0.5 text-sm">
                  {o.items.map((i) => (
                    <li key={i.id}>
                      <div className="flex justify-between gap-3"><span>{i.quantity} × {i.name}{i.options.length > 0 && <span className="text-neutral-500"> ({i.options.join(", ")})</span>}</span><span>{sum(i.lineTotal)}</span></div>
                      {!o.paid && o.status !== "CANCELLED" && <VoidItemForm action={voidItemAction} tableId={table.id} item={i} needsApproval={needsManagerApproval(o, can(user.role, "orders.cancel"))} />}
                    </li>
                  ))}
                </ul>
                {o.note && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">«{o.note}»</p>}
                {o.status === "READY" && !o.paid && (
                  <form action={serveOrderAction}>
                    <input type="hidden" name="tableId" value={table.id} /><input type="hidden" name="orderId" value={o.id} />
                    <button className="rounded-lg border border-green-700 px-3 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-50">Подано к столу</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {bill && live.length > 0 && (
          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            {toPay.length === 0 ? (
              <p className="text-sm text-neutral-600">Все заказы оплачены. Счёт закроется сам, когда оплачен последний заказ.</p>
            ) : (
              <>
                {total !== due && <p className="text-xs text-neutral-500">Всего по столу: {sum(total)}, осталось оплатить заказов на {sum(due)}.</p>}
                {!shift && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Чтобы принять оплату, <Link href="/pos" className="font-bold underline">откройте смену</Link>.</p>}
                <BillPayForm key={toPay.map((o) => o.id).join("|")} billId={bill.id} tableId={table.id} orders={toPay} feePct={feePct} canPay={!!shift} onlyOne={toPay.length === 1} />
                <p className="text-xs text-neutral-500">Оплата попадёт в вашу смену. Склад спишется. Счёт закроется, когда оплачен последний заказ.</p>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
