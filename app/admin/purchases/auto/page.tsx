import Link from "next/link";
import { pageGuard, formLocations } from "@/lib/guard";
import { getSuggestions, DEFAULT_COVER_DAYS, DEFAULT_LEAD_DAYS } from "@/services/auto-order";
import { AutoOrderForm } from "@/components/admin/AutoOrderForm";
import { createDraftsAction } from "./actions";

const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm";

/** Автозаказ: система сама собирает, что и у кого заказать по минимальным остаткам и расходу за месяц. */
export default async function AutoOrderPage({ searchParams }: { searchParams: Promise<{ loc?: string; cover?: string; lead?: string }> }) {
  await pageGuard("purchases.manage");
  const sp = await searchParams;
  const { options, defaultId } = await formLocations();
  const locationId = options.some((o) => o.id === sp.loc) ? sp.loc! : defaultId;
  const cover = Math.min(60, Math.max(1, Number(sp.cover) || DEFAULT_COVER_DAYS));
  const lead = Math.min(30, Math.max(0, sp.lead === undefined ? DEFAULT_LEAD_DAYS : Number(sp.lead) || 0));
  const lines = locationId ? await getSuggestions(locationId, { coverDays: cover, leadDays: lead }) : [];
  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Автозаказ поставщикам</h1>
          <p className="text-sm text-neutral-500">Что закончится или уже ниже минимума, с учётом расхода за последние 30 дней и того, что уже заказано. Проверьте количества и создайте черновики: по одному на поставщика.</p>
        </div>
        <Link href="/admin/purchases" className="text-sm text-green-800 underline">← К закупкам</Link>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        {options.length > 1 && (
          <label className="block text-sm"><span className="mb-1 block text-neutral-600">Точка</span>
            <select name="loc" defaultValue={locationId} className={input}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        )}
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Запас после поставки, дней</span><input name="cover" type="number" min="1" max="60" defaultValue={cover} className={`${input} w-28`} /></label>
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Срок доставки, дней</span><input name="lead" type="number" min="0" max="30" defaultValue={lead} className={`${input} w-28`} /></label>
        <button className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">Пересчитать</button>
      </form>
      {lines.length === 0
        ? <p className="rounded-2xl bg-white p-8 text-center text-neutral-600 shadow-sm">Всё в порядке: ниже минимума ничего нет, заказывать нечего. Минимальный остаток задаётся в карточке продукта.</p>
        : <AutoOrderForm key={`${locationId}-${cover}-${lead}`} action={createDraftsAction} locationId={locationId} lines={lines} />}
    </div>
  );
}
