import Link from "next/link";
import { FilterForm } from "@/components/admin/FilterForm";
import type { Range } from "@/services/dashboard";

const iso = (x: Date) => new Date(x.getTime() + 5 * 3600000).toISOString().slice(0, 10);

/** Период отчёта: быстрые пресеты ссылками и свой диапазон дат. */
export function RangeBar({ base, range }: { base: string; range: Range }) {
  const tabs: [string, string][] = [["today", "Сегодня"], ["7", "7 дней"], ["30", "30 дней"]];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map(([k, l]) => (
        <Link key={k} href={`${base}?range=${k}`} className={`rounded-full px-4 py-1.5 text-sm ${range.key === k ? "bg-green-700 text-white" : "bg-white text-neutral-700 hover:bg-neutral-100"}`}>{l}</Link>
      ))}
      <FilterForm key={`${range.key}${range.from.getTime()}`} className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="range" value="custom" />
        <input type="date" name="from" defaultValue={iso(range.from)} className="rounded-lg border border-neutral-200 bg-white px-2 py-1" />
        <span className="text-neutral-400">—</span>
        <input type="date" name="to" defaultValue={iso(new Date(range.to.getTime() - 1))} className="rounded-lg border border-neutral-200 bg-white px-2 py-1" />
        <span className={`rounded-full px-3 py-1.5 ${range.key === "custom" ? "bg-green-700 text-white" : "bg-white text-neutral-500"}`}>Свой период</span>
      </FilterForm>
    </div>
  );
}
