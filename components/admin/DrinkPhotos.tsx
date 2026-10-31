"use client";
import { useState, useTransition } from "react";
import { applyDrinkPhotosAction } from "@/app/admin/products/photos/actions";

type Row = { id: string; name: string; category: string; image: string | null; suggestedKey: string; kind: "match" | "fallback" };
type Lib = { key: string; label: string; thumb: string };

/** Список напитков: текущее фото, предложенное фото (можно сменить), галочка «заменить». Без фото отмечены сразу. */
export function DrinkPhotos({ rows, library }: { rows: Row[]; library: Lib[] }) {
  const thumb = new Map(library.map((l) => [l.key, l.thumb]));
  const [keys, setKeys] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.id, r.suggestedKey])));
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map((r) => [r.id, !r.image && r.kind === "match"])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const count = rows.filter((r) => on[r.id]).length;
  const setAll = (f: (r: Row) => boolean) => setOn(Object.fromEntries(rows.map((r) => [r.id, f(r)])));
  const btn = "rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => setAll(() => true)}>Выбрать все</button>
        <button type="button" className={btn} onClick={() => setAll((r) => !r.image && r.kind === "match")}>Только без фото (с точным подбором)</button>
        <button type="button" className={btn} onClick={() => setAll(() => false)}>Снять все</button>
        <span className="text-sm text-neutral-500">Отмечено: {count} из {rows.length}</span>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className={`grid items-center gap-3 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-[auto_1fr_auto_auto] ${on[r.id] ? "ring-2 ring-green-600" : ""}`}>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={!!on[r.id]} onChange={(e) => setOn((o) => ({ ...o, [r.id]: e.target.checked }))} aria-label={`Заменить фото: ${r.name}`} className="size-5" />
            </label>
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.name}</p>
              <p className="text-xs text-neutral-500">{r.category}{r.kind === "fallback" ? " · точного совпадения нет, общее фото" : ""}</p>
              <select value={keys[r.id]} onChange={(e) => setKeys((k) => ({ ...k, [r.id]: e.target.value }))} aria-label={`Фото для ${r.name}`} className="mt-1 w-full max-w-64 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs">
                {library.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </div>
            <figure className="text-center">
              {r.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.image} alt="" loading="lazy" className="size-20 rounded-xl object-cover" />
                : <span className="grid size-20 place-items-center rounded-xl bg-neutral-100 text-xs text-neutral-500">нет фото</span>}
              <figcaption className="mt-1 text-[11px] text-neutral-500">сейчас</figcaption>
            </figure>
            <figure className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb.get(keys[r.id])} alt={`Предложенное фото: ${r.name}`} loading="lazy" className="size-20 rounded-xl object-cover" />
              <figcaption className="mt-1 text-[11px] font-semibold text-green-800">будет</figcaption>
            </figure>
          </li>
        ))}
      </ul>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="sticky bottom-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-lg">
        <button type="button" disabled={pending || count === 0}
          onClick={() => start(async () => { setError(null); const r = await applyDrinkPhotosAction(rows.filter((x) => on[x.id]).map((x) => ({ productId: x.id, key: keys[x.id] }))); if (r?.error) setError(r.error); })}
          className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-50">
          {pending ? "Применяем…" : `Применить (${count})`}
        </button>
        <span className="text-xs text-neutral-500">Фото на сайте обновятся сразу. Прежние ссылки сохранятся в журнале действий.</span>
      </div>
    </div>
  );
}
