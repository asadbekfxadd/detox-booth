import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getBrand } from "@/services/brand";
import { getStaffTable, listTablesWithBills } from "@/services/tables";
import { STATUS_LABEL, STATUS_CLS } from "@/lib/order-status";
import { groupByCourse, heldOrders } from "@/lib/waiter";
import { sum, dateTimeStr } from "@/lib/format";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { WaiterHeader } from "@/components/waiter/WaiterHeader";
import { fireAction, cancelHeldAction, serveAction, requestBillAction, moveTableAction } from "@/app/waiter/actions";

export const dynamic = "force-dynamic";

export default async function WaiterTablePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await pageGuard("waiter.use");
  const [{ id }, { error, ok }] = await Promise.all([params, searchParams]);
  const [data, brand] = await Promise.all([getStaffTable(id, user), getBrand()]);
  if (!data) notFound();
  const { table, bill, orders, total, blockers } = data;
  const live = orders.filter((o) => o.status !== "CANCELLED");
  const groups = groupByCourse(live);
  const held = heldOrders(live);
  const others = (await listTablesWithBills(table.locationId)).filter((t) => t.id !== table.id);
  const btn = "min-h-12 rounded-xl px-4 py-2 font-bold";

  return (
    <main className="p-4">
      <AutoRefresh active everyMs={8000} />
      <WaiterHeader brandName={brand.name} userName={user.name ?? ""} back={{ href: "/waiter", label: "Все столы" }} />
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Стол {table.number}</h1>
          {bill?.requested && <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold text-white">Просит счёт</span>}
          <Link href={`/waiter/tables/${table.id}/order`} className={`${btn} ml-auto bg-green-700 text-white`}>+ Новый заказ</Link>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}
        {ok && <p role="status" className="rounded-xl bg-lime-100 px-4 py-3 text-sm font-semibold text-green-900">{ok}</p>}

        {held.length > 0 && (
          <form action={fireAction} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-violet-400 bg-violet-50 p-4">
            <input type="hidden" name="tableId" value={table.id} />
            <p className="flex-1 text-sm font-semibold text-violet-900">Ждут отправки на кухню: {held.length}</p>
            <button className={`${btn} bg-violet-700 text-white`}>Отправить всё на кухню</button>
          </form>
        )}

        {live.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-neutral-600">За столом пока нет заказов. Нажмите «Новый заказ».</p>
        ) : groups.map((g) => (
          <section key={g.course} className="space-y-2">
            {groups.length > 1 && <h2 className="text-sm font-bold text-neutral-600">{g.label}</h2>}
            <ul className="space-y-3">
              {g.orders.map((o) => (
                <li key={o.id} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">№{o.number} <span className="text-sm font-normal text-neutral-500">{dateTimeStr(o.createdAt)}</span></p>
                    {o.onHold && o.status === "NEW"
                      ? <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">Ждёт отправки</span>
                      : o.paid ? <span className="rounded bg-lime-100 px-2 py-0.5 text-xs font-semibold text-green-900">Оплачен</span> : <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[o.status] ?? ""}`}>{STATUS_LABEL[o.status] ?? o.status}</span>}
                  </div>
                  <ul className="space-y-0.5 text-sm">
                    {o.items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-3"><span>{i.quantity} × {i.name}{i.options.length > 0 && <span className="text-neutral-500"> ({i.options.join(", ")})</span>}</span><span>{sum(i.lineTotal)}</span></li>
                    ))}
                  </ul>
                  {o.note && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">«{o.note}»</p>}
                  <div className="flex flex-wrap gap-2">
                    {o.onHold && o.status === "NEW" && (
                      <>
                        <form action={fireAction}><input type="hidden" name="tableId" value={table.id} /><input type="hidden" name="orderId" value={o.id} /><button className="min-h-11 rounded-lg bg-violet-700 px-4 font-semibold text-white">На кухню</button></form>
                        <form action={cancelHeldAction}><input type="hidden" name="tableId" value={table.id} /><input type="hidden" name="orderId" value={o.id} /><button className="min-h-11 rounded-lg border border-red-300 px-4 font-semibold text-red-700">Отменить</button></form>
                      </>
                    )}
                    {o.status === "READY" && (
                      <form action={serveAction}><input type="hidden" name="tableId" value={table.id} /><input type="hidden" name="orderId" value={o.id} /><button className="min-h-11 rounded-lg bg-green-700 px-4 font-semibold text-white">Подано к столу</button></form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {bill && live.length > 0 && (
          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            <p className="flex items-baseline justify-between gap-4 text-2xl font-black"><span>Итого</span><span>{sum(total)}</span></p>
            {blockers.length > 0 && <p className="text-xs text-neutral-500">Ещё в работе: {blockers.map((n) => `№${n}`).join(", ")}</p>}
            <div className="flex flex-wrap gap-2">
              <a href={`/print/bill/${bill.id}`} target="_blank" rel="noreferrer" className={`${btn} border-2 border-neutral-300`}>Печать счёта</a>
              {!bill.requested && <form action={requestBillAction}><input type="hidden" name="tableId" value={table.id} /><button className={`${btn} border-2 border-orange-500 text-orange-700`}>Попросить счёт</button></form>}
              {can(user.role, "pos.use") && <Link href={`/pos/tables/${table.id}`} className={`${btn} bg-neutral-900 text-white`}>Закрыть счёт на кассе</Link>}
            </div>
          </section>
        )}

        {bill && live.length > 0 && others.length > 0 && (
          <form action={moveTableAction} className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
            <input type="hidden" name="tableId" value={table.id} />
            <label htmlFor="to" className="block text-sm font-bold">Пересадить гостей</label>
            <div className="flex flex-wrap gap-2">
              <select id="to" name="toTableId" required defaultValue="" className="min-h-12 min-w-0 flex-1 basis-48 rounded-xl border border-neutral-300 bg-white px-3">
                <option value="" disabled>Выберите стол</option>
                {others.map((t) => <option key={t.id} value={t.id}>Стол {t.number}{t.bill ? ` · занят, счета объединятся` : " · свободен"}</option>)}
              </select>
              <button className={`${btn} bg-neutral-900 text-white`}>Перенести</button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
