import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { dispatchBoard, type DeliveryRow } from "@/services/delivery";
import { STAGE_LABEL, mapsUrl } from "@/lib/delivery";
import { coordMapsUrl } from "@/lib/geo";
import { sum, dateTimeStr } from "@/lib/format";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { AssignCourier } from "@/components/admin/AssignCourier";
import { ActionButton } from "@/components/admin/ActionButton";
import { markDeliveredAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Доставка" };

type Couriers = { id: string; name: string; active: number }[];

function Card({ o, couriers }: { o: DeliveryRow; couriers: Couriers }) {
  const closed = o.stage === "done" || o.stage === "cancelled";
  return (
    <article className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <Link href={`/admin/orders/${o.id}`} className="text-lg font-extrabold hover:underline">№{o.number}</Link>
        <span className="text-xs text-neutral-500">{dateTimeStr(o.createdAt)}</span>
      </div>
      {o.scheduledFor && <p className="inline-block rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-900">К {dateTimeStr(o.scheduledFor)}</p>}
      <p className="font-semibold">{o.address} {o.address && <a href={mapsUrl(o.address)} target="_blank" rel="noreferrer" className="text-xs font-normal text-green-800 underline">карта</a>}{o.geo && <> <a href={coordMapsUrl(o.geo.lat, o.geo.lng)} target="_blank" rel="noreferrer" className="text-xs font-normal text-green-800 underline">где клиент</a></>}</p>
      <p className="text-neutral-600">{o.customer}{o.phone ? ` · ${o.phone}` : ""}{o.zone ? ` · ${o.zone}` : ""}</p>
      <p className="text-neutral-600">{o.summary}</p>
      <p className="font-semibold">{sum(o.total)} <span className="font-normal text-neutral-500">{o.collect.amount > 0 ? "· получить с клиента" : o.paidOnline ? "· оплачено" : ""}</span></p>
      {!closed && o.stage !== "onway" && <AssignCourier orderId={o.id} courierId={o.courierId} couriers={couriers} />}
      {o.stage === "onway" && <p className="rounded bg-sky-50 px-2 py-1 text-sky-900">Везёт: <b>{o.courierName ?? "—"}</b></p>}
      {o.stage === "done" && o.courierName && <p className="text-neutral-500">Курьер: {o.courierName}</p>}
      {(o.stage === "waiting" || o.stage === "assigned" || o.stage === "onway") && (
        <ActionButton action={markDeliveredAction} fields={{ orderId: o.id }} label="Отметить доставленным" confirmText={`Заказ №${o.number} доставлен клиенту?`} />
      )}
    </article>
  );
}

export default async function DeliveryPage() {
  const user = await pageGuard("orders.manage");
  const { locationId, locations } = await getScope();
  const b = await dispatchBoard(user, locationId);
  const place = locations.find((l) => l.id === locationId)?.name ?? "Все точки";
  const cols: { key: string; title: string; rows: DeliveryRow[]; hint?: string }[] = [
    { key: "cooking", title: STAGE_LABEL.cooking, rows: b.rows.filter((r) => r.stage === "cooking") },
    { key: "waiting", title: "Готовы, нужен курьер", rows: b.rows.filter((r) => r.stage === "waiting" || r.stage === "assigned") },
    { key: "onway", title: STAGE_LABEL.onway, rows: b.rows.filter((r) => r.stage === "onway") },
    { key: "done", title: "Доставлены за сутки", rows: b.doneRows },
  ];
  const couriers: Couriers = b.couriers.map((c) => ({ id: c.id, name: c.name ?? "Курьер", active: c.active }));
  return (
    <div className="space-y-5">
      <AutoRefresh active everyMs={10000} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Доставка · {place}</h1>
          <p className="text-sm text-neutral-500">Обновляется сама каждые 10 секунд · активных доставок: {b.rows.length}</p>
        </div>
        <div className="flex gap-2">
          {can(user.role, "settings.edit") && <Link href="/admin/delivery/zones" className="rounded-xl border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold hover:bg-neutral-50">Зоны доставки</Link>}
          {can(user.role, "employees.manage") && <Link href="/admin/employees" className="rounded-xl border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold hover:bg-neutral-50">Курьеры</Link>}
        </div>
      </div>

      <section aria-label="Курьеры" className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-bold">Курьеры</h2>
        {b.couriers.length === 0
          ? <p className="text-sm text-neutral-600">Курьеров пока нет. Создайте сотрудника с ролью «Курьер» в разделе «Сотрудники» и привяжите его к точке. Без курьеров заказы выдаёт кухня, как раньше.</p>
          : (
            <ul className="flex flex-wrap gap-2">
              {b.couriers.map((c) => (
                <li key={c.id} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"><b>{c.name}</b> · в работе: {c.active} · доставил: {c.delivered}</li>
              ))}
            </ul>
          )}
      </section>

      <div className="grid gap-4 lg:grid-cols-4">
        {cols.map((c) => (
          <section key={c.key} aria-label={c.title} className="space-y-3 rounded-2xl bg-neutral-100 p-3">
            <h2 className="flex items-center justify-between font-bold"><span>{c.title}</span><span className="rounded-full bg-white px-2.5 py-0.5 text-xs">{c.rows.length}</span></h2>
            {c.rows.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">Пусто</p>}
            {c.rows.map((o) => <Card key={o.id} o={o} couriers={couriers} />)}
          </section>
        ))}
      </div>
    </div>
  );
}
