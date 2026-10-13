import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { getBrand } from "@/services/brand";
import { listTablesWithBills } from "@/services/tables";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { NewOrderSound } from "@/components/kitchen/NewOrderSound";
import { WaiterHeader } from "@/components/waiter/WaiterHeader";
import { sum } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WaiterHome() {
  const user = await pageGuard("waiter.use");
  const [scope, brand] = await Promise.all([getScope(), getBrand()]);
  const locationId = scope.locationId ?? user.locationId ?? scope.locations[0]?.id ?? null;
  const tables = locationId ? await listTablesWithBills(locationId) : [];
  const ready = tables.reduce((n, t) => n + (t.bill?.ready ?? 0), 0);
  const requests = tables.filter((t) => t.bill?.requested).length;

  return (
    <main className="p-4">
      <AutoRefresh active everyMs={8000} />
      <WaiterHeader brandName={brand.name} userName={user.name ?? ""} posHref={can(user.role, "pos.use") ? "/pos/tables" : null} adminHref={can(user.role, "dashboard.view") ? "/admin/dashboard" : null} />
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Зал</h1>
          <NewOrderSound count={ready} />
          {ready > 0 && <b className="rounded-full bg-green-700 px-3 py-0.5 text-sm text-white">готово к подаче: {ready}</b>}
          {requests > 0 && <b className="rounded-full bg-orange-500 px-3 py-0.5 text-sm text-white">просят счёт: {requests}</b>}
        </div>
        {tables.length === 0
          ? <p className="rounded-2xl bg-white p-8 text-center text-neutral-600">Столов пока нет. Владелец добавляет их в админке: «Столы и QR».</p>
          : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {tables.map((t) => {
                const b = t.bill;
                const tone = !b ? "border-neutral-200 bg-white" : b.requested ? "border-orange-500 bg-orange-50 ring-2 ring-orange-400" : b.ready > 0 ? "border-green-600 bg-green-50 ring-2 ring-green-500" : "border-lime-500 bg-lime-50";
                return (
                  <li key={t.id}>
                    <Link href={`/waiter/tables/${t.id}`} className={`block min-h-32 rounded-2xl border-2 p-4 shadow-sm active:scale-[.98] ${tone}`}>
                      <p className="text-3xl font-black">{t.number}</p>
                      {!b ? <p className="mt-2 text-sm text-neutral-500">Свободен</p> : (
                        <>
                          <p className="mt-1 text-lg font-bold">{sum(b.total)}</p>
                          {b.requested && <p className="text-sm font-bold text-orange-700">Просит счёт</p>}
                          {b.ready > 0 && <p className="text-sm font-bold text-green-800">Готово к подаче: {b.ready}</p>}
                          {b.held > 0 && <p className="text-xs font-bold text-violet-700">Ждёт отправки: {b.held}</p>}
                          {b.inWork - b.held > 0 && <p className="text-xs text-neutral-600">Готовится: {b.inWork - b.held}</p>}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </main>
  );
}
