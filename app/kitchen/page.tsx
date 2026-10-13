import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { kitchenOrders } from "@/services/orders";
import { stationOptions } from "@/services/stations";
import { hasCouriers } from "@/services/delivery";
import { linesFor, isDone, parseStationFilter, NO_STATION } from "@/lib/station";
import { dateTimeStr } from "@/lib/format";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { KitchenButton } from "@/components/kitchen/KitchenButton";
import { NewOrderSound } from "@/components/kitchen/NewOrderSound";
import { AutoPrint } from "@/components/kitchen/AutoPrint";
import { kitchenLogoutAction } from "./actions";

export const dynamic = "force-dynamic";

const COLUMNS = [
  { key: "new", title: "Новые", statuses: ["NEW", "CONFIRMED"], accent: "border-sky-400" },
  { key: "cooking", title: "Готовятся", statuses: ["PREPARING"], accent: "border-amber-400" },
  { key: "ready", title: "Готовы", statuses: ["READY"], accent: "border-lime-400" },
] as const;
const NEXT_BTN: Record<string, { to: string; label: string; tone: "primary" | "ready" | "done" }> = {
  NEW: { to: "CONFIRMED", label: "Принять", tone: "primary" },
  CONFIRMED: { to: "PREPARING", label: "Начать готовить", tone: "primary" },
  PREPARING: { to: "READY", label: "Готово", tone: "ready" },
  READY: { to: "COMPLETED", label: "Выдан клиенту", tone: "done" },
};

export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
  const user = await pageGuard("orders.manage");
  const [{ station: rawStation }, { locationId, locations }, stations] = await Promise.all([searchParams, getScope(), stationOptions()]);
  const [all, courierMode] = await Promise.all([kitchenOrders(locationId), hasCouriers(locationId)]);
  const filter = parseStationFilter(rawStation, stations.map((s) => s.id));
  const nameOf = new Map(stations.map((s) => [s.id, s.name]));
  const hasUnassigned = all.some((o) => o.lines.some((l) => l.stationId == null));
  const orders = all.filter((o) => linesFor(o.lines, filter).length > 0);
  const place = locations.find((l) => l.id === locationId)?.name ?? "Все точки";
  const fresh = orders.filter((o) => o.status === "NEW").length;
  const stationName = filter === NO_STATION ? "Без станции" : filter ? nameOf.get(filter) : null;
  const tabs = [{ key: "", label: "Все" }, ...stations.map((s) => ({ key: s.id, label: s.name })), ...(hasUnassigned && stations.length > 0 ? [{ key: NO_STATION, label: "Без станции" }] : [])];
  const stationQuery = filter ? `&station=${filter}` : "";

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <AutoRefresh active everyMs={10000} />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Кухня{stationName ? ` · ${stationName}` : ""} · {place}</h1>
          <p className="text-sm text-neutral-400">Экран обновляется сам каждые 10 секунд · в работе: {orders.length}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutoPrint orders={orders.filter((o) => o.status === "NEW" || o.status === "CONFIRMED").map((o) => o.id)} station={filter} />
          <NewOrderSound count={fresh} />
          {can(user.role, "dashboard.view") && <Link href="/admin/orders" className="min-h-11 rounded-full border border-neutral-600 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-800">Админка</Link>}
          <form action={kitchenLogoutAction}><button className="min-h-11 rounded-full border border-neutral-600 px-4 text-sm font-semibold hover:bg-neutral-800">Выйти</button></form>
        </div>
      </header>

      {stations.length > 0 && (
        <nav aria-label="Станция" className="mb-4 flex flex-wrap gap-2">
          {tabs.map((t) => {
            const on = (filter ?? "") === t.key;
            return <Link key={t.key} href={t.key ? `/kitchen?station=${t.key}` : "/kitchen"} aria-current={on ? "page" : undefined} className={`min-h-11 rounded-full px-5 py-2.5 text-sm font-bold ${on ? "bg-amber-400 text-neutral-950" : "border border-neutral-600 hover:bg-neutral-800"}`}>{t.label}</Link>;
          })}
        </nav>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => (col.statuses as readonly string[]).includes(o.status));
          return (
            <section key={col.key} aria-label={col.title} className="space-y-3 rounded-2xl bg-neutral-900 p-3">
              <h2 className="flex items-center justify-between px-1 text-lg font-bold"><span>{col.title}</span><span className="rounded-full bg-neutral-800 px-3 py-0.5 text-sm">{list.length}</span></h2>
              {list.length === 0 && <p className="py-8 text-center text-neutral-500">Пока пусто</p>}
              {list.map((o) => {
                const lines = linesFor(o.lines, filter);
                const stationMode = filter != null && o.status === "PREPARING";
                const mineDone = isDone(lines);
                const base = NEXT_BTN[o.status];
                const toCourier = courierMode && o.fulfillment === "DELIVERY" && o.status === "READY"; // доставку завершает курьер, а не кухня
                const btn = toCourier ? undefined : base && o.source === "TABLE" && o.status === "READY" ? { ...base, label: "Подано к столу" } : base; // оплата за столом идёт отдельно, на кассе
                const late = o.ageMin >= 15 && !o.scheduled;
                return (
                  <article key={o.id} className={`space-y-3 rounded-xl border-l-8 bg-neutral-800 p-4 ${col.accent} ${late ? "ring-2 ring-red-500" : ""}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-3xl font-black">№{o.number}{o.tableNumber != null && <span className="ml-3 rounded-lg bg-orange-500 px-3 py-0.5 align-middle text-2xl text-neutral-950">Стол {o.tableNumber}</span>}</p>
                      <p className={`text-sm font-semibold ${late ? "text-red-300" : "text-neutral-300"}`}>{o.ageMin} мин назад</p>
                    </div>
                    <p className="text-sm text-neutral-300">
                      {o.source === "TABLE" ? `Гость за столом ${o.tableNumber ?? ""}, принести к столу` : `${o.source === "WEB" ? "Сайт" : "Касса"} · ${o.fulfillment === "DELIVERY" ? "Доставка" : "Самовывоз"}${o.customer ? ` · ${o.customer}` : ""}`}
                    </p>
                    {o.scheduled && <p className="inline-block rounded-lg bg-sky-900 px-3 py-1 text-sm font-bold text-sky-100">Выдать к {dateTimeStr(o.dueAt)}</p>}
                    <ul className="space-y-2">
                      {lines.map((l) => (
                        <li key={l.id}>
                          <p className={`text-xl font-bold ${l.readyAt && o.status === "PREPARING" ? "text-lime-300" : ""}`}>
                            {l.readyAt && o.status === "PREPARING" && <span aria-label="готово">✓ </span>}{l.quantity} × {l.name}
                            {filter == null && stations.length > 0 && <span className="ml-2 rounded bg-neutral-700 px-2 py-0.5 align-middle text-xs font-semibold text-neutral-200">{l.stationId ? nameOf.get(l.stationId) : "Без станции"}</span>}
                          </p>
                          {l.options.length > 0 && <p className="text-base text-amber-200">{l.options.join(" · ")}</p>}
                        </li>
                      ))}
                    </ul>
                    {o.fulfillment === "DELIVERY" && o.address && <p className="text-base font-semibold text-sky-200">Адрес: {o.address}</p>}
                    {toCourier && <p className="rounded-xl bg-sky-950 px-4 py-3 text-center font-bold text-sky-200">{o.pickedUp ? `Курьер ${o.courierName ?? ""} забрал заказ` : o.courierName ? `Ждёт курьера: ${o.courierName}` : "Курьер ещё не назначен"}</p>}
                    {o.note && <p className="rounded-lg bg-amber-900/60 px-3 py-2 text-base font-semibold text-amber-100">Комментарий: {o.note}</p>}
                    {o.unpaidOnline && <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200">Онлайн-оплата не подтверждена</p>}
                    {stationMode
                      ? (mineDone
                        ? <p className="rounded-xl bg-lime-950 px-4 py-3 text-center font-bold text-lime-200">Ваша станция готова. Ждём остальных.</p>
                        : <KitchenButton id={o.id} to="READY" label={`Готово · ${stationName}`} tone="ready" station={filter!} />)
                      : btn && <KitchenButton id={o.id} to={btn.to} label={btn.label} tone={btn.tone} />}
                    <a href={`/print/kitchen/${o.id}?${stationQuery.slice(1)}`} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-neutral-400 underline hover:text-white">Печать бегунка</a>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
