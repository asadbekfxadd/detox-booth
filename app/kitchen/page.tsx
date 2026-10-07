import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { kitchenOrders } from "@/services/orders";
import { dateTimeStr } from "@/lib/format";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { KitchenButton } from "@/components/kitchen/KitchenButton";
import { NewOrderSound } from "@/components/kitchen/NewOrderSound";
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

export default async function KitchenPage() {
  const user = await pageGuard("orders.manage");
  const { locationId, locations } = await getScope();
  const orders = await kitchenOrders(locationId);
  const place = locations.find((l) => l.id === locationId)?.name ?? "Все точки";
  const fresh = orders.filter((o) => o.status === "NEW").length;

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <AutoRefresh active everyMs={10000} />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Кухня · {place}</h1>
          <p className="text-sm text-neutral-400">Экран обновляется сам каждые 10 секунд · в работе: {orders.length}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NewOrderSound count={fresh} />
          {can(user.role, "dashboard.view") && <Link href="/admin/orders" className="min-h-11 rounded-full border border-neutral-600 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-800">Админка</Link>}
          <form action={kitchenLogoutAction}><button className="min-h-11 rounded-full border border-neutral-600 px-4 text-sm font-semibold hover:bg-neutral-800">Выйти</button></form>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => (col.statuses as readonly string[]).includes(o.status));
          return (
            <section key={col.key} aria-label={col.title} className="space-y-3 rounded-2xl bg-neutral-900 p-3">
              <h2 className="flex items-center justify-between px-1 text-lg font-bold"><span>{col.title}</span><span className="rounded-full bg-neutral-800 px-3 py-0.5 text-sm">{list.length}</span></h2>
              {list.length === 0 && <p className="py-8 text-center text-neutral-500">Пока пусто</p>}
              {list.map((o) => {
                const btn = NEXT_BTN[o.status];
                const late = o.ageMin >= 15 && !o.scheduled;
                return (
                  <article key={o.id} className={`space-y-3 rounded-xl border-l-8 bg-neutral-800 p-4 ${col.accent} ${late ? "ring-2 ring-red-500" : ""}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-3xl font-black">№{o.number}</p>
                      <p className={`text-sm font-semibold ${late ? "text-red-300" : "text-neutral-300"}`}>{o.ageMin} мин назад</p>
                    </div>
                    <p className="text-sm text-neutral-300">
                      {o.source === "WEB" ? "Сайт" : "Касса"} · {o.fulfillment === "DELIVERY" ? "Доставка" : "Самовывоз"}{o.customer ? ` · ${o.customer}` : ""}
                    </p>
                    {o.scheduled && <p className="inline-block rounded-lg bg-sky-900 px-3 py-1 text-sm font-bold text-sky-100">Выдать к {dateTimeStr(o.dueAt)}</p>}
                    <ul className="space-y-2">
                      {o.lines.map((l) => (
                        <li key={l.id}>
                          <p className="text-xl font-bold">{l.quantity} × {l.name}</p>
                          {l.options.length > 0 && <p className="text-base text-amber-200">{l.options.join(" · ")}</p>}
                        </li>
                      ))}
                    </ul>
                    {o.note && <p className="rounded-lg bg-amber-900/60 px-3 py-2 text-base font-semibold text-amber-100">Комментарий: {o.note}</p>}
                    {o.unpaidOnline && <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200">Онлайн-оплата не подтверждена</p>}
                    {btn && <KitchenButton id={o.id} to={btn.to} label={btn.label} tone={btn.tone} />}
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
