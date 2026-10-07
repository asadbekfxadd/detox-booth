import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOrder } from "@/services/web-orders";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { sum, dateTimeStr } from "@/lib/format";
import { ACTIVE, FULFILL_LABEL, METHOD_LABEL, PAY_LABEL } from "@/lib/order-status";

const STEPS = [["NEW", "Принят"], ["CONFIRMED", "Подтверждён"], ["PREPARING", "Готовится"], ["READY", "Готов"], ["COMPLETED", "Выдан"]] as const;
const HINT: Record<string, (d: boolean) => string> = {
  NEW: () => "Заказ принят. Точка скоро его подтвердит.",
  CONFIRMED: () => "Заказ подтверждён и скоро будет в работе.",
  PREPARING: () => "Мы готовим ваш заказ.",
  READY: (d) => (d ? "Заказ готов и скоро будет отправлен." : "Заказ готов — можно забирать!"),
  COMPLETED: () => "Заказ выдан. Приятного аппетита!",
  CANCELLED: () => "Заказ отменён. Если это неожиданно, свяжитесь с точкой.",
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getPublicOrder(id);
  if (!o) notFound();
  const delivery = o.fulfillment === "DELIVERY";
  const idx = STEPS.findIndex(([s]) => s === o.status);
  const cancelled = o.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <AutoRefresh active={(ACTIVE as readonly string[]).includes(o.status)} />
      <div>
        <p className="text-sm text-muted">{o.customerName ? `${o.customerName}, спасибо за заказ!` : "Спасибо за заказ!"}</p>
        <h1 className="text-3xl font-extrabold">Заказ №{o.number}</h1>
        <p className="text-sm text-muted">{dateTimeStr(o.createdAt)} · {FULFILL_LABEL[o.fulfillment]} · {o.location.name}</p>
      </div>

      <div className={`rounded-2xl p-5 border border-line ${cancelled ? "bg-red-50" : "bg-white"}`}>
        <p className="font-bold">{HINT[o.status]?.(delivery)}</p>
        {!cancelled && (
          <ol className="mt-4 grid grid-cols-5 gap-1 text-center text-xs">
            {STEPS.map(([s, l], i) => (
              <li key={s}>
                <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full font-bold ${i <= idx ? "bg-ink text-white" : "bg-line text-muted"}`}>{i < idx || o.status === "COMPLETED" ? "✓" : i + 1}</div>
                <p className={`mt-1 ${i === idx ? "font-semibold" : "text-muted"}`}>{l}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-muted">Страница обновляется сама. Сохраните эту ссылку, чтобы следить за заказом.</p>
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-5 border border-line">
        {o.items.map((i) => (
          <div key={i.id} className="flex justify-between gap-3 text-sm">
            <span>{i.quantity} × <b>{i.name}</b>{i.options.length > 0 && <span className="text-muted"> ({i.options.join(", ")})</span>}</span>
            <span className="whitespace-nowrap">{sum(i.unitPrice * i.quantity)}</span>
          </div>
        ))}
        <div className="space-y-1 border-t pt-3 text-sm">
          <p className="flex justify-between"><span>Сумма</span><span>{sum(o.subtotal)}</span></p>
          {o.discount > 0 && <p className="flex justify-between text-leaf"><span>Скидка{o.promoCode ? ` (${o.promoCode})` : ""}</span><span>−{sum(o.discount)}</span></p>}
          {o.deliveryFee > 0 && <p className="flex justify-between"><span>Доставка</span><span>{sum(o.deliveryFee)}</span></p>}
          <p className="flex justify-between text-lg font-bold"><span>Итого</span><span>{sum(o.total)}</span></p>
        </div>
        {o.payment && <p className="text-sm text-muted">Оплата: {METHOD_LABEL[o.payment.method]} при получении · {PAY_LABEL[o.payment.status]}</p>}
        {delivery && o.address && <p className="text-sm text-muted">Адрес доставки: {o.address}</p>}
        {!delivery && o.location.address && <p className="text-sm text-muted">Забрать: {o.location.name}, {o.location.address}</p>}
        {o.pointsEarned > 0 && <p className="text-sm font-semibold text-leaf">Начислено баллов: {o.pointsEarned}</p>}
      </div>
      <Link href="/menu" className="inline-block rounded-full border border-ink px-6 py-3 font-semibold text-leaf hover:bg-lime-soft">Заказать ещё</Link>
    </div>
  );
}
