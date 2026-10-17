"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtQty, bigUnit } from "@/lib/ingredient-units";
import { money, dateStr } from "@/lib/format";

export type StockRow = {
  id: string; sku: string; name: string; category: string; unit: string; min: number; max: number; cost: number;
  supplier: string | null; total: number; low: boolean; perLocation: { name: string; qty: number; low: boolean }[] | null; expiry: number | null;
};
type Filter = "all" | "low" | "expiry";
const DAY = 86400000;

/** Все продукты склада в одной таблице: поиск, фильтры «мало» и «срок», быстрый приход и переход к редактированию. */
export function StockTable({ rows, now, showCost, edit }: { rows: StockRow[]; now: number; showCost: boolean; edit: boolean }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const expState = (r: StockRow) => (r.expiry == null ? "ok" : r.expiry < now ? "expired" : r.expiry < now + 3 * DAY ? "soon" : "ok");
  const counts = useMemo(() => ({ low: rows.filter((r) => r.low).length, expiry: rows.filter((r) => expState(r) !== "ok").length }), [rows, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase().replace(/ё/g, "е");
    return rows.filter((r) => {
      if (f === "low" && !r.low) return false;
      if (f === "expiry" && expState(r) === "ok") return false;
      return !n || `${r.name} ${r.category} ${r.sku} ${r.supplier ?? ""}`.toLowerCase().replace(/ё/g, "е").includes(n);
    });
  }, [rows, q, f, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const chip = (id: Filter, label: string, n?: number) => (
    <button type="button" onClick={() => setF(id)} aria-pressed={f === id}
      className={`rounded-full px-3 py-1.5 text-sm ${f === id ? "bg-lime-100 font-semibold text-green-900" : "bg-white text-neutral-700 hover:bg-neutral-100"} border border-neutral-200`}>
      {label}{n != null && n > 0 ? ` · ${n}` : ""}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти продукт, категорию или поставщика" aria-label="Поиск по складу"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600 sm:w-80" />
        {chip("all", "Все", rows.length)}
        {chip("low", "Мало", counts.low)}
        {chip("expiry", "Срок горит", counts.expiry)}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2 [&_th:first-child]:pl-4 [&_td:first-child]:pl-4">
          <thead><tr className="text-left text-neutral-500">
            <th className="py-3">Продукт</th><th>Категория</th><th className="text-right">Остаток</th><th className="text-right">Минимум</th>
            <th>Статус</th><th>Ближайший срок</th>{showCost && <th className="text-right">Цена</th>}<th>Поставщик</th><th className="py-3" />
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="p-10 text-center text-neutral-500">
                <p className="font-medium text-neutral-700">Продуктов на складе пока нет</p>
                <p className="mt-1">Добавьте первые: клубника, банан, молоко. Потом оформите приход одним списком.</p>
                {edit && <Link href="/admin/ingredients/new" className="mt-4 inline-block rounded-xl bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800">+ Новый продукт</Link>}
              </td></tr>
            )}
            {rows.length > 0 && shown.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-neutral-500">Ничего не найдено</td></tr>}
            {shown.map((r) => {
              const st = expState(r);
              return (
                <tr key={r.id} className="border-t border-neutral-100 [&>td]:py-2.5 [&>td]:align-middle">
                  <td className="font-medium">{edit ? <Link href={`/admin/ingredients/${r.id}`} className="hover:text-green-800 hover:underline">{r.name}</Link> : r.name}<span className="block text-xs font-normal text-neutral-400">{r.sku}</span></td>
                  <td>{r.category}</td>
                  <td className="text-right">
                    <b className={r.low ? "text-red-700" : ""}>{fmtQty(r.unit, r.total)}</b>
                    {r.perLocation && r.perLocation.length > 1 && <div className="text-xs text-neutral-500">{r.perLocation.map((p) => <div key={p.name} className={p.low ? "text-red-700" : ""}>{p.name}: {fmtQty(r.unit, p.qty)}</div>)}</div>}
                  </td>
                  <td className="text-right text-neutral-500">{r.min > 0 ? fmtQty(r.unit, r.min) : "—"}</td>
                  <td>{r.low ? <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Мало</span> : <span className="rounded bg-lime-100 px-2 py-0.5 text-xs text-green-900">В норме</span>}</td>
                  <td className={st === "expired" ? "font-semibold text-red-700" : st === "soon" ? "text-amber-700" : ""}>{r.expiry ? dateStr(new Date(r.expiry)) : "—"}</td>
                  {showCost && <td className="whitespace-nowrap text-right">{r.cost > 0 ? `${money(r.cost * bigUnit(r.unit).factor)} / ${bigUnit(r.unit).label}` : "—"}</td>}
                  <td>{r.supplier ?? "—"}</td>
                  <td className="whitespace-nowrap text-right [&:last-child]:pr-4">{edit && <Link href={`/admin/inventory/receive?ing=${r.id}`} className="text-green-800 underline">+ Приход</Link>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
