import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { getScope } from "@/lib/location";
import { getOpenShift } from "@/services/pos";
import { listTablesWithBills } from "@/services/tables";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { NewOrderSound } from "@/components/kitchen/NewOrderSound";
import { sum } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Столы" };

export default async function PosTablesPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const user = await pageGuard("pos.use");
  const { paid } = await searchParams;
  const [shift, scope] = await Promise.all([getOpenShift(user.id), getScope()]);
  const locationId = shift?.locationId ?? scope.locationId ?? scope.locations[0]?.id ?? null;
  const tables = locationId ? await listTablesWithBills(locationId) : [];
  const busy = tables.filter((t) => t.bill).length;
  const requests = tables.filter((t) => t.bill?.requested).length;
  const fresh = tables.reduce((n, t) => n + (t.bill?.fresh ?? 0), 0);

  return (
    <main className="min-h-screen bg-[#f7f3ea] p-4">
      <AutoRefresh active everyMs={8000} />
      <header className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Столы</h1>
        <span className="text-sm text-neutral-600">занято: {busy} из {tables.length}{requests > 0 && <b className="ml-3 rounded-full bg-orange-500 px-3 py-0.5 text-white">просят счёт: {requests}</b>}</span>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <NewOrderSound count={fresh} />
          <Link href="/pos" className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 hover:bg-neutral-50">Касса</Link>
          <Link href="/pos/shift" className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 hover:bg-neutral-50">Смена</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-4">
        {paid != null && <p role="status" className="rounded-xl bg-lime-100 px-4 py-3 font-semibold text-green-900">Счёт закрыт: {sum(Number(paid) || 0)}</p>}
        {!shift && <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">Смена не открыта: заказы видны, но принять оплату можно только после <Link href="/pos" className="font-bold underline">открытия смены</Link>.</p>}
        {tables.length === 0
          ? <p className="rounded-2xl bg-white p-8 text-center text-neutral-600">Столов пока нет. Добавьте их в админке: «Столы и QR».</p>
          : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {tables.map((t) => {
                const b = t.bill;
                const tone = !b ? "border-neutral-200 bg-white" : b.requested ? "border-orange-500 bg-orange-50 ring-2 ring-orange-400" : "border-lime-500 bg-lime-50";
                return (
                  <li key={t.id}>
                    <Link href={`/pos/tables/${t.id}`} className={`block min-h-32 rounded-2xl border-2 p-4 shadow-sm transition hover:-translate-y-0.5 ${tone}`}>
                      <p className="text-3xl font-black">{t.number}</p>
                      {!b ? <p className="mt-2 text-sm text-neutral-500">Свободен</p> : (
                        <>
                          <p className="mt-1 text-lg font-bold">{sum(b.total)}</p>
                          <p className="text-xs text-neutral-600">заказов: {b.orders}{b.inWork > 0 && ` · готовится: ${b.inWork}`}</p>
                          {b.requested && <p className="mt-1 text-sm font-bold text-orange-700">Просит счёт</p>}
                          {b.fresh > 0 && <p className="text-xs font-bold text-sky-700">Новых: {b.fresh}</p>}
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
