import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getOrder } from "@/services/orders";
import { ActionButton } from "@/components/admin/ActionButton";
import { ReasonForm } from "@/components/admin/OrderActions";
import { advanceOrderAction, confirmPaymentAction, cancelOrderAction, refundOrderAdminAction } from "../actions";
import { money, dateTimeStr } from "@/lib/format";
import { STATUS_LABEL, STATUS_CLS, NEXT, SOURCE_LABEL, FULFILL_LABEL, METHOD_LABEL, PAY_LABEL, PAY_CLS, ACTIVE } from "@/lib/order-status";

const OK: Record<string, string> = { status: "Статус обновлён", paid: "Оплата подтверждена", cancelled: "Заказ отменён", refunded: "Возврат оформлен" };
const ACTION_LABEL: Record<string, string> = {
  POS_ORDER_CREATED: "Заказ проведён на кассе", ORDER_STATUS_CHANGED: "Смена статуса", PAYMENT_CONFIRMED: "Оплата подтверждена",
  ORDER_CANCELLED: "Заказ отменён", ORDER_REFUNDED: "Возврат оформлен", MANUAL_DISCOUNT: "Ручная скидка",
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const user = await pageGuard("orders.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const o = await getOrder(id, user);
  if (!o) notFound();
  const manage = can(user.role, "orders.manage");
  const active = (ACTIVE as readonly string[]).includes(o.status);
  const next = NEXT[o.status];
  const pay = o.payments[0];
  const needPayment = o.status === "NEW" && pay?.status === "PENDING" && pay.method === "ONLINE";
  const showCost = can(user.role, "products.cost");
  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Заказ №{o.number}</h1>
        <Link href="/admin/orders" className="text-sm text-green-800 underline">← К списку</Link>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 text-sm shadow-sm">
        <span className={`rounded px-2 py-1 text-xs font-semibold ${STATUS_CLS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
        <span>{SOURCE_LABEL[o.source]} · {FULFILL_LABEL[o.fulfillment]}</span>
        <span>Точка: <b>{o.location}</b></span>
        <span>Создан: <b>{dateTimeStr(o.createdAt)}</b></span>
        {o.completedAt && <span>Завершён: <b>{dateTimeStr(o.completedAt)}</b></span>}
        {o.cashier && <span>Кассир: <b>{o.cashier}</b></span>}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
          <h2 className="font-bold">Клиент</h2>
          {o.customer ? <p><b>{o.customer.name}</b><br />{o.customer.phone}</p> : <p className="text-neutral-500">Не указан</p>}
          {o.address && <p>Адрес: {o.address}</p>}
          {o.pointsEarned > 0 && <p className="text-green-800">Начислено баллов: {o.pointsEarned}</p>}
        </div>
        <div className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
          <h2 className="font-bold">Оплата</h2>
          {o.payments.map((p) => <p key={p.id} className="flex items-center justify-between"><span>{METHOD_LABEL[p.method]} · {money(p.amount)}</span><span className={`rounded px-2 py-0.5 text-xs ${PAY_CLS[p.status]}`}>{PAY_LABEL[p.status]}</span></p>)}
          {o.promoCode && <p className="text-neutral-600">Промокод: {o.promoCode}</p>}
          <p className="text-xs text-neutral-500">Склад: {o.inventoryDeducted ? "ингредиенты списаны" : "ингредиенты ещё не списаны"}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Позиция</th><th className="text-right">Кол-во</th><th className="text-right">Цена</th><th className="p-3 text-right">Сумма</th></tr></thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id} className="border-t border-neutral-100">
                <td className="p-3"><b>{i.name}</b>{i.modifiers.length > 0 && <span className="block text-xs text-neutral-500">{i.modifiers.join(", ")}</span>}</td>
                <td className="text-right">{i.quantity}</td><td className="text-right">{money(i.unitPrice)}</td><td className="p-3 text-right">{money(i.unitPrice * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr className="border-t border-neutral-100"><td className="p-3 text-neutral-500" colSpan={3}>Сумма</td><td className="p-3 text-right">{money(o.subtotal)}</td></tr>
            {o.discount > 0 && <tr><td className="px-3 pb-2 text-neutral-500" colSpan={3}>Скидка</td><td className="px-3 pb-2 text-right text-green-800">−{money(o.discount)}</td></tr>}
            {o.deliveryFee > 0 && <tr><td className="px-3 pb-2 text-neutral-500" colSpan={3}>Доставка</td><td className="px-3 pb-2 text-right">{money(o.deliveryFee)}</td></tr>}
            <tr className="border-t border-neutral-100 font-bold"><td className="p-3" colSpan={3}>Итого</td><td className="p-3 text-right">{money(o.total)}</td></tr>
            {showCost && o.inventoryDeducted && <tr className="text-neutral-500"><td className="px-3 pb-3" colSpan={3}>Себестоимость · маржа</td><td className="px-3 pb-3 text-right">{money(o.cogs)} · {money(o.total - o.cogs)}</td></tr>}
          </tfoot>
        </table>
      </div>

      {manage && (active || o.status === "COMPLETED") && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl bg-white p-5 shadow-sm">
          {needPayment && <ActionButton action={confirmPaymentAction} fields={{ id: o.id }} label="Подтвердить оплату" />}
          {next && !needPayment && <ActionButton action={advanceOrderAction} fields={{ id: o.id, to: next.to }} label={next.label} />}
          {active && can(user.role, "orders.cancel") && (
            <ReasonForm action={cancelOrderAction} id={o.id} label="Отменить заказ" submitLabel="Отменить заказ" showRestock restockDefault={o.status === "NEW" || o.status === "CONFIRMED"}
              hint={o.inventoryDeducted ? "Ингредиенты уже списаны. Если продукт не готовили, верните их на склад." : "Оплаченная сумма будет помечена как возвращённая."} />
          )}
          {o.status === "COMPLETED" && can(user.role, "pos.refund") && (
            <ReasonForm action={refundOrderAdminAction} id={o.id} label="Оформить возврат" submitLabel="Вернуть деньги" hint="Ингредиенты на склад не возвращаются (продукт приготовлен). Начисленные клиенту баллы будут списаны." />
          )}
        </div>
      )}

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-bold">История</h2>
        <ul className="space-y-1 text-sm">
          <li className="flex justify-between"><span>Заказ создан</span><span className="text-neutral-500">{dateTimeStr(o.createdAt)}</span></li>
          {o.log.map((l) => (
            <li key={l.id} className="flex justify-between gap-4">
              <span>{ACTION_LABEL[l.action] ?? l.action}{l.to && ` → ${STATUS_LABEL[l.to] ?? l.to}`}{l.reason && ` · «${l.reason}»`}{l.by && <span className="text-neutral-500"> · {l.by}</span>}</span>
              <span className="whitespace-nowrap text-neutral-500">{dateTimeStr(l.at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
