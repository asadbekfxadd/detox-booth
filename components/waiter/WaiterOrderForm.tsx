"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sum } from "@/lib/format";
import { COURSES, defaultHold } from "@/lib/waiter";
import { createWaiterOrderAction } from "@/app/waiter/actions";
import type { PosCatalog, CatalogProduct } from "@/services/pos";

type Line = { key: string; product: CatalogProduct; optionIds: string[]; quantity: number };

const lineUnit = (p: CatalogProduct, optionIds: string[]) =>
  p.price + p.modifiers.flatMap((m) => m.options).filter((o) => optionIds.includes(o.id)).reduce((a, o) => a + o.priceDelta, 0);
const optionNames = (p: CatalogProduct, optionIds: string[]) => p.modifiers.flatMap((m) => m.options).filter((o) => optionIds.includes(o.id)).map((o) => o.name);

export function WaiterOrderForm({ tableId, tableNumber, catalog }: { tableId: string; tableNumber: number; catalog: PosCatalog }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cat, setCat] = useState(catalog.categories[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picking, setPicking] = useState<{ product: CatalogProduct; chosen: Record<string, string[]> } | null>(null);
  const [course, setCourse] = useState(1);
  const [hold, setHold] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return catalog.products.filter((p) => (s ? p.name.toLowerCase().includes(s) : p.categoryId === cat));
  }, [catalog, cat, q]);
  const total = lines.reduce((a, l) => a + lineUnit(l.product, l.optionIds) * l.quantity, 0);
  const count = lines.reduce((a, l) => a + l.quantity, 0);

  function add(product: CatalogProduct, optionIds: string[]) {
    const key = `${product.id}:${[...optionIds].sort().join(",")}`;
    setLines((ls) => ls.some((l) => l.key === key) ? ls.map((l) => l.key === key ? { ...l, quantity: Math.min(50, l.quantity + 1) } : l) : [...ls, { key, product, optionIds, quantity: 1 }]);
  }
  function tap(p: CatalogProduct) {
    if (!p.isAvailable || p.portions === 0) return;
    if (p.modifiers.length === 0) return add(p, []);
    setPicking({ product: p, chosen: Object.fromEntries(p.modifiers.map((m) => [m.id, m.required && !m.multiple && m.options[0] ? [m.options[0].id] : []])) });
  }
  const change = (key: string, d: number) => setLines((ls) => ls.flatMap((l) => l.key !== key ? [l] : l.quantity + d <= 0 ? [] : [{ ...l, quantity: Math.min(50, l.quantity + d) }]));

  function pickCourse(c: number) { setCourse(c); setHold(defaultHold(c)); }

  function submit() {
    setError("");
    start(async () => {
      const r = await createWaiterOrderAction({
        tableId, course, hold, note: note.trim() || undefined,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, optionIds: l.optionIds })),
      });
      if (!r.ok) { setError(r.error); return; }
      router.push(`/waiter/tables/${tableId}?ok=${encodeURIComponent(`Заказ №${r.number} ${hold ? "сохранён, ждёт отправки" : "отправлен на кухню"}`)}`);
    });
  }

  const picked = picking;
  const pickedOk = picked ? picked.product.modifiers.every((m) => !m.required || (picked.chosen[m.id]?.length ?? 0) > 0) : false;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-3 p-4 pb-72">
      <header className="flex items-center gap-3">
        <Link href={`/waiter/tables/${tableId}`} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm">← Назад</Link>
        <h1 className="text-xl font-bold">Новый заказ · стол {tableNumber}</h1>
      </header>
      <label className="sr-only" htmlFor="search">Поиск по меню</label>
      <input id="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти позицию" className="min-h-12 rounded-xl border border-neutral-300 bg-white px-4" />
      {!q && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Категории">
          {catalog.categories.map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${cat === c.id ? "border-green-700 bg-green-700 text-white" : "border-neutral-300 bg-white"}`}>{c.name}</button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {shown.map((p) => {
          const off = !p.isAvailable || p.portions === 0;
          return (
            <li key={p.id}>
              <button onClick={() => tap(p)} disabled={off} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-2 text-left shadow-sm active:scale-[.98] disabled:opacity-40">
                <span className="font-semibold">{p.name}{off && <span className="block text-xs font-normal text-neutral-500">Нет в наличии</span>}</span>
                <span className="whitespace-nowrap text-sm text-neutral-700">{sum(p.price)}</span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="col-span-full rounded-xl bg-white p-6 text-center text-neutral-500">Ничего не найдено</li>}
      </ul>

      <section aria-label="Заказ" className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white p-3 shadow-[0_-4px_20px_rgba(0,0,0,.08)]">
        <div className="mx-auto max-w-3xl space-y-2">
          {lines.length > 0 && (
            <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-2">
                  <span className="flex-1 truncate">{l.product.name}{l.optionIds.length > 0 && <span className="text-neutral-500"> ({optionNames(l.product, l.optionIds).join(", ")})</span>}</span>
                  <button aria-label="Меньше" onClick={() => change(l.key, -1)} className="size-9 rounded-lg border border-neutral-300 font-bold">−</button>
                  <span className="w-6 text-center font-bold">{l.quantity}</span>
                  <button aria-label="Больше" onClick={() => change(l.key, 1)} className="size-9 rounded-lg border border-neutral-300 font-bold">+</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1" role="group" aria-label="Подача">
              {COURSES.map((c) => (
                <button key={c.value} aria-pressed={course === c.value} onClick={() => pickCourse(c.value)} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${course === c.value ? "border-violet-700 bg-violet-700 text-white" : "border-neutral-300"}`}>{c.label}</button>
              ))}
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} className="size-5" />Придержать</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={250} placeholder="Комментарий для кухни" aria-label="Комментарий для кухни" className="min-h-10 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 text-sm" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>}
          <button onClick={submit} disabled={pending || lines.length === 0} className="min-h-14 w-full rounded-xl bg-green-700 px-4 text-lg font-bold text-white disabled:opacity-40">
            {pending ? "Отправляем…" : lines.length === 0 ? "Добавьте позиции" : `${hold ? "Сохранить" : "На кухню"} · ${count} шт · ${sum(total)}`}
          </button>
        </div>
      </section>

      {picked && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label={picked.product.name}>
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl">
            <h2 className="text-lg font-bold">{picked.product.name}</h2>
            {picked.product.modifiers.map((m) => (
              <fieldset key={m.id} className="mt-3 space-y-1">
                <legend className="text-sm font-bold">{m.name}{m.required && <span className="font-normal text-neutral-500"> · обязательно</span>}</legend>
                {m.options.map((o) => {
                  const on = picked.chosen[m.id]?.includes(o.id) ?? false;
                  return (
                    <label key={o.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-200 px-3">
                      <input type={m.multiple ? "checkbox" : "radio"} name={m.id} checked={on} className="size-5"
                        onChange={() => setPicking((pk) => pk && ({ ...pk, chosen: { ...pk.chosen, [m.id]: m.multiple ? (on ? pk.chosen[m.id].filter((x) => x !== o.id) : [...pk.chosen[m.id], o.id]) : [o.id] } }))} />
                      <span className="flex-1">{o.name}</span>
                      {o.priceDelta !== 0 && <span className="text-sm text-neutral-600">{o.priceDelta > 0 ? "+" : ""}{sum(o.priceDelta)}</span>}
                    </label>
                  );
                })}
              </fieldset>
            ))}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setPicking(null)} className="min-h-12 rounded-xl border border-neutral-300 font-semibold">Отмена</button>
              <button disabled={!pickedOk} onClick={() => { add(picked.product, Object.values(picked.chosen).flat()); setPicking(null); }} className="min-h-12 rounded-xl bg-green-700 font-bold text-white disabled:opacity-40">Добавить</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
