import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOrder } from "@/services/web-orders";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { sum, dateTimeStr } from "@/lib/format";
import { ACTIVE, FULFILL_LABEL, METHOD_LABEL, PAY_LABEL } from "@/lib/order-status";
import { Page } from "@/components/site/Page";
import { RepeatOrder } from "@/components/site/RepeatOrder";
import { RememberOrder } from "@/components/site/RememberOrder";

const STEPS = [["NEW", "Принят"], ["CONFIRMED", "Подтверждён"], ["PREPARING", "Готовится"], ["READY", "Готов"], ["COMPLETED", "Выдан"]] as const;
const HINT: Record<string, (d: boolean) => string> = {
  NEW: () => "Заказ принят. Точка скоро его подтвердит.",
  CONFIRMED: () => "Заказ подтверждён и скоро будет в работе.",
  PREPARING: () => "Мы готовим ваш заказ.",
  READY: (d) => (d ? "Заказ готов и скоро будет отправлен." : "Заказ готов — можно забирать!"),
  COMPLETED: () => "Заказ выдан. Приятного аппетита!",
  CANCELLED: () => "Заказ отменён. Если это неожиданно, свяжитесь с точкой.",
};

export const metadata = { title: "Ваш заказ", robots: { index: false, follow: false } };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getPublicOrder(id);
  if (!o) notFound();
  const delivery = o.fulfillment === "DELIVERY";
  const idx = STEPS.findIndex(([s]) => s === o.status);
  const cancelled = o.status === "CANCELLED";

  return (
    <Page>
    <div className="mx-auto max-w-2xl space-y-5">
      <RememberOrder id={o.id} />
      <AutoRefresh active={(ACTIVE as readonly string[]).includes(o.status)} />
      <div>
        <p className="text-sm text-forest/60">{o.customerName ? `${o.customerName}, спасибо за заказ!` : "Спасибо за заказ!"}</p>
        <h1 className="text-3xl font-extrabold">Заказ №{o.number}</h1>
        <p className="text-sm text-forest/60">{dateTimeStr(o.createdAt)} · {FULFILL_LABEL[o.fulfillment]} · {o.location.name}</p>
        <p className="text-sm font-semibold">Получить: {o.scheduledFor ? dateTimeStr(o.scheduledFor) : "как можно скорее"}</p>
      </div>

      <div className={`rounded-2xl p-5 pop ${cancelled ? "bg-red-50" : "bg-white"}`}>
        <p className="font-bold" role="status" aria-live="polite">{HINT[o.status]?.(delivery)}</p>
        {!cancelled && (
          <ol className="mt-4 grid grid-cols-5 gap-1 text-center text-xs">
            {STEPS.map(([s, l], i) => (
              <li key={s} aria-current={i === idx ? "step" : undefined}>
                <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full font-bold border ${i <= idx ? "border-forest bg-forest text-white" : "border-forest/25 bg-white text-forest/60"}`}>{i < idx || o.status === "COMPLETED" ? "✓" : i + 1}</div>
                <p className={`mt-1 ${i === idx ? "font-semibold" : "text-forest/60"}`}>{l}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-forest/60">Страница обновляется сама. Сохраните эту ссылку, чтобы следить за заказом.</p>
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-5 pop">
        {o.items.map((i) => (
          <div key={i.id} className="flex justify-between gap-3 text-sm">
            <span>{i.quantity} × <b>{i.name}</b>{i.options.length > 0 && <span className="text-forest/60"> ({i.options.join(", ")})</span>}</span>
            <span className="whitespace-nowrap">{sum(i.unitPrice * i.quantity)}</span>
          </div>
        ))}
        <div className="space-y-1 border-t pt-3 text-sm">
          <p className="flex justify-between"><span>Сумма</span><span>{sum(o.subtotal)}</span></p>
          {o.discount > 0 && <p className="flex justify-between font-semibold text-forest"><span>Скидка{o.promoCode ? ` (${o.promoCode})` : ""}</span><span>−{sum(o.discount)}</span></p>}
          {o.deliveryFee > 0 && <p className="flex justify-between"><span>Доставка</span><span>{sum(o.deliveryFee)}</span></p>}
          <p className="flex justify-between text-lg font-bold"><span>Итого</span><span>{sum(o.total)}</span></p>
        </div>
        {o.payment && <p className="text-sm text-forest/60">Оплата: {o.payment.method === "ONLINE" ? "онлайн" : `${METHOD_LABEL[o.payment.method]} при получении`} · {PAY_LABEL[o.payment.status]}</p>}
        {delivery && o.address && <p className="text-sm text-forest/60">Адрес доставки: {o.address}</p>}
        {!delivery && o.location.address && <p className="text-sm text-forest/60">Забрать: {o.location.name}, {o.location.address}</p>}
        {o.note && <p className="text-sm text-forest/70">Ваш комментарий: {o.note}</p>}
        {o.pointsEarned > 0 && <p className="text-sm font-semibold text-forest">Начислено баллов: {o.pointsEarned}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <RepeatOrder lines={o.items.map((i) => ({ productId: i.productId, quantity: i.quantity, optionIds: i.optionIds }))} />
        <Link href="/menu" className="btn btn-ghost pop">Заказать ещё</Link>
      </div>
    </div>
    </Page>
  );
}
