import { pageGuard } from "@/lib/guard";
import { getBrand } from "@/services/brand";
import { courierBoard, type DeliveryRow } from "@/services/delivery";
import { STAGE_LABEL, mapsUrl, telHref } from "@/lib/delivery";
import { coordMapsUrl } from "@/lib/geo";
import { sum, dateTimeStr } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/order-status";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { NewOrderSound } from "@/components/kitchen/NewOrderSound";
import { CourierButton } from "@/components/courier/CourierButton";
import { claimAction, releaseAction, pickUpAction, deliverAction, courierLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

function Card({ o, mine }: { o: DeliveryRow; mine: boolean }) {
  return (
    <article className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-black">№{o.number}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${o.stage === "onway" ? "bg-sky-100 text-sky-900" : o.stage === "cooking" ? "bg-amber-100 text-amber-900" : "bg-lime-100 text-green-900"}`}>{STAGE_LABEL[o.stage]}</span>
      </div>
      {o.scheduledFor && <p className="inline-block rounded-lg bg-sky-100 px-3 py-1 text-sm font-bold text-sky-900">Привезти к {dateTimeStr(o.scheduledFor)}</p>}
      <p className="text-lg font-semibold">{o.address}</p>
      {o.zone && <p className="text-sm text-neutral-600">Зона: {o.zone}</p>}
      <div className="grid grid-cols-2 gap-2">
        {o.geo && <a href={coordMapsUrl(o.geo.lat, o.geo.lng)} target="_blank" rel="noreferrer" className="col-span-2 flex min-h-12 items-center justify-center rounded-xl bg-neutral-900 font-semibold text-white">Где клиент (по геопозиции)</a>}
        {o.address && <a href={mapsUrl(o.address)} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-xl border border-neutral-300 font-semibold">На карте</a>}
        {o.phone && <a href={telHref(o.phone)} className="flex min-h-12 items-center justify-center rounded-xl border border-neutral-300 font-semibold">Позвонить</a>}
      </div>
      <p className="text-sm text-neutral-700">{o.customer}{o.phone ? ` · ${o.phone}` : ""}</p>
      <p className="text-sm text-neutral-600">{o.summary}</p>
      {o.note && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">«{o.note}»</p>}
      {o.collect.amount > 0
        ? <p className="rounded-xl bg-orange-100 px-4 py-3 text-lg font-bold text-orange-900">Получить с клиента: {sum(o.collect.amount)} ({METHOD_LABEL[o.collect.method ?? ""]?.toLowerCase() ?? "при получении"})</p>
        : <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm font-semibold text-green-900">{o.paidOnline ? "Оплачено, ничего брать не нужно" : "Оплата онлайн, деньги брать не нужно"}</p>}
      {!mine && <CourierButton action={claimAction} id={o.id} label="Взять заказ" />}
      {mine && o.stage === "cooking" && <p className="text-center text-sm font-semibold text-neutral-600">Заказ готовится. Когда будет готов, появится кнопка «Забрал».</p>}
      {mine && (o.stage === "assigned" || o.stage === "waiting") && <CourierButton action={pickUpAction} id={o.id} label="Забрал, выезжаю" />}
      {mine && o.stage === "onway" && <CourierButton action={deliverAction} id={o.id} label={o.collect.amount > 0 ? `Доставил, получил ${sum(o.collect.amount)}` : "Доставил"} tone="done" confirmText="Заказ доставлен клиенту?" />}
      {mine && o.stage !== "onway" && <CourierButton action={releaseAction} id={o.id} label="Отказаться от заказа" tone="ghost" confirmText="Отдать заказ другому курьеру?" />}
    </article>
  );
}

export default async function CourierPage() {
  const user = await pageGuard("courier.use");
  const [brand, board] = await Promise.all([getBrand(), courierBoard(user)]);
  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <AutoRefresh active everyMs={10000} />
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold text-green-800">{brand.name}</span>
        <span className="text-sm text-neutral-600">{user.name}</span>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <NewOrderSound count={board.free.length} />
          <form action={courierLogoutAction}><button className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 hover:bg-neutral-50">Выйти</button></form>
        </div>
      </header>
      <p className="text-sm text-neutral-600">Доставлено за сутки: <b>{board.doneToday}</b></p>

      <section aria-label="Мои заказы" className="space-y-3">
        <h1 className="text-xl font-extrabold">Мои заказы ({board.mine.length})</h1>
        {board.mine.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-neutral-600">Пока нет заказов. Возьмите свободный ниже или дождитесь назначения.</p>}
        {board.mine.map((o) => <Card key={o.id} o={o} mine />)}
      </section>

      <section aria-label="Свободные заказы" className="space-y-3">
        <h2 className="text-xl font-extrabold">Свободные ({board.free.length})</h2>
        {board.free.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-neutral-600">Свободных заказов нет.</p>}
        {board.free.map((o) => <Card key={o.id} o={o} mine={false} />)}
      </section>
    </main>
  );
}
