import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { getOpenShift } from "@/services/pos";
import { getStaffTable } from "@/services/tables";
import { STATUS_LABEL, STATUS_CLS } from "@/lib/order-status";
import { sum, dateTimeStr } from "@/lib/format";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { closeBillAction, serveOrderAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PosTablePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await pageGuard("pos.use");
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [data, shift] = await Promise.all([getStaffTable(id, user), getOpenShift(user.id)]);
  if (!data) notFound();
  const { table, bill, orders, total, blockers } = data;
  const live = orders.filter((o) => o.status !== "CANCELLED");
  const canClose = !!bill && !!shift && blockers.length === 0;
  const btn = "min-h-14 rounded-xl px-4 py-3 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <main className="min-h-screen bg-[#f7f3ea] p-4">
      <AutoRefresh active everyMs={8000} />
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center gap-3">
          <Link href="/pos/tables" className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">← Все столы</Link>
          <h1 className="text-2xl font-bold">Стол {table.number}</h1>
          {bill?.requested && <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold text-white">Просит счёт</span>}
        </header>
        {error && <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}

        {live.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-neutral-600">{bill ? "Все заказы отменены. Закройте счёт в админке или дождитесь новых заказов." : "Стол свободен. Заказы появятся, когда гость отсканирует QR и отправит заказ."}</p>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id} className={`space-y-2 rounded-2xl bg-white p-4 shadow-sm ${o.status === "CANCELLED" ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">№{o.number} <span className="text-sm font-normal text-neutral-500">{dateTimeStr(o.createdAt)}</span></p>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[o.status] ?? ""}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                </div>
                <ul className="space-y-0.5 text-sm">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3"><span>{i.quantity} × {i.name}{i.options.length > 0 && <span className="text-neutral-500"> ({i.options.join(", ")})</span>}</span><span>{sum(i.lineTotal)}</span></li>
                  ))}
                </ul>
                {o.note && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">«{o.note}»</p>}
                {o.status === "READY" && (
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
            <p className="flex items-baseline justify-between gap-4 text-2xl font-black"><span>Итого</span><span>{sum(total)}</span></p>
            {blockers.length > 0 && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Ещё готовятся заказы: {blockers.map((n) => `№${n}`).join(", ")}. Закрыть счёт можно, когда кухня их отдаст.</p>}
            {!shift && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Чтобы принять оплату, <Link href="/pos" className="font-bold underline">откройте смену</Link>.</p>}
            <form action={closeBillAction} className="grid grid-cols-2 gap-3">
              <input type="hidden" name="billId" value={bill.id} /><input type="hidden" name="tableId" value={table.id} />
              <button name="method" value="CASH" disabled={!canClose} className={`${btn} bg-green-700 text-white`}>Наличные</button>
              <button name="method" value="CARD" disabled={!canClose} className={`${btn} bg-neutral-900 text-white`}>Картой</button>
            </form>
            <p className="text-xs text-neutral-500">Оплата попадёт в вашу смену. Склад спишется, счёт стола закроется.</p>
          </section>
        )}
      </div>
    </main>
  );
}
