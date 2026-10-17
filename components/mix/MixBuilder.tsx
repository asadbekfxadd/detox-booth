"use client";
import { useMemo, useState } from "react";
import { sum } from "@/lib/format";
import type { MixCatalog } from "@/services/mix";
import type { MixInput } from "@/lib/mix";

export type MixPick = { mix: MixInput; price: number; sizeName: string; names: string[] };

const SKINS = {
  site: {
    chip: (on: boolean) => `min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${on ? "border-forest bg-forest text-white" : "border-forest/20 text-forest/85 hover:border-forest/60 hover:bg-sand"}`,
    size: (on: boolean) => `min-h-12 flex-1 rounded-xl border px-4 py-2 text-left transition ${on ? "border-forest bg-forest text-white" : "border-forest/20 text-forest hover:border-forest/60"}`,
    input: "min-h-11 w-full rounded-xl border border-forest/20 bg-white px-4 text-base outline-none focus:border-forest",
    label: "text-sm font-extrabold",
    muted: "text-forest/60",
    add: "press w-full rounded-xl bg-orange px-7 py-3.5 text-lg font-black text-forest-deep disabled:cursor-not-allowed disabled:bg-forest/8 disabled:text-forest/40 disabled:shadow-none sm:w-auto",
    step: "flex items-center rounded-xl border border-forest/20 bg-white text-forest",
  },
  pos: {
    chip: (on: boolean) => `min-h-11 rounded-full border px-4 py-2 text-sm font-semibold ${on ? "border-green-700 bg-green-700 text-white" : "border-neutral-300 bg-white"}`,
    size: (on: boolean) => `min-h-12 flex-1 rounded-xl border px-4 py-2 text-left ${on ? "border-green-700 bg-green-700 text-white" : "border-neutral-300 bg-white"}`,
    input: "min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base outline-none focus:border-green-600",
    label: "text-sm font-bold",
    muted: "text-neutral-500",
    add: "min-h-12 w-full rounded-xl bg-green-700 px-6 font-bold text-white disabled:opacity-40",
    step: "flex items-center rounded-xl border border-neutral-300 bg-white",
  },
} as const;

/**
 * Конструктор «Свой микс»: размер → любые ингредиенты → цена считается на глазах.
 * Цену здесь считаем для показа; при заказе сервер пересчитает всё сам.
 */
export function MixBuilder({ catalog, skin = "site", withQuantity = false, addLabel = "В корзину", onAdd }: {
  catalog: MixCatalog; skin?: keyof typeof SKINS; withQuantity?: boolean; addLabel?: string;
  onAdd: (pick: MixPick, quantity: number) => void;
}) {
  const k = SKINS[skin];
  const [sizeId, setSizeId] = useState(catalog.sizes[0]?.id ?? "");
  const [chosen, setChosen] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);

  const size = catalog.sizes.find((s) => s.id === sizeId) ?? catalog.sizes[0];
  const byId = useMemo(() => new Map(catalog.ingredients.map((i) => [i.id, i])), [catalog]);
  const picked = chosen.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  const price = size ? size.price + picked.reduce((a, i) => a + i.surcharge, 0) : 0;
  const perGrams = size && picked.length ? Math.round(size.grams / picked.length) : 0;

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const map = new Map<string, MixCatalog["ingredients"]>();
    for (const i of catalog.ingredients) {
      if (s && !i.name.toLowerCase().includes(s)) continue;
      map.set(i.category, [...(map.get(i.category) ?? []), i]);
    }
    return [...map.entries()];
  }, [catalog, q]);

  const toggle = (id: string) => { setDone(false); setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])); };
  if (!size) return null;

  return (
    <div className="space-y-6" data-mix-builder>
      <fieldset>
        <legend className={`mb-2 ${k.label}`}>Размер</legend>
        <div className="flex flex-wrap gap-2">
          {catalog.sizes.map((s) => (
            <button key={s.id} type="button" aria-pressed={s.id === size.id} onClick={() => { setDone(false); setSizeId(s.id); }} className={k.size(s.id === size.id)}>
              <span className="block font-bold">{s.name}</span>
              <span className="block text-sm opacity-80">от {sum(s.price)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={`mb-2 ${k.label}`}>Ингредиенты · выбирайте любые</legend>
        <label className="sr-only" htmlFor="mix-search">Найти ингредиент</label>
        <input id="mix-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти: яблоко, имбирь…" className={`${k.input} mb-3`} />
        <div className="space-y-4">
          {groups.length === 0 && <p className={`text-sm ${k.muted}`}>Такого ингредиента нет.</p>}
          {groups.map(([cat, list]) => (
            <div key={cat}>
              <p className={`mb-1.5 text-xs font-semibold ${k.muted}`}>{cat}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((i) => {
                  const on = chosen.includes(i.id);
                  return (
                    <button key={i.id} type="button" aria-pressed={on} data-ingredient={i.name} onClick={() => toggle(i.id)} className={k.chip(on)}>
                      {on && <span aria-hidden>✓ </span>}{i.name}{i.surcharge > 0 && <span className="ml-1 opacity-75">+{sum(i.surcharge)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className={`rounded-2xl p-4 ${skin === "site" ? "bg-sand" : "bg-neutral-100"}`} aria-live="polite">
        {picked.length === 0
          ? <p className={`text-sm ${k.muted}`}>Выберите ингредиенты — соберём стакан и посчитаем цену.</p>
          : (
            <div className="space-y-1">
              <p className="font-bold" data-mix-summary>{size.name}: {picked.map((i) => i.name).join(", ")}</p>
              <p className={`text-sm ${k.muted}`}>По ~{perGrams} г каждого: состав делится поровну.</p>
            </div>
          )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {withQuantity && (
          <div className={k.step}>
            <button type="button" aria-label="Меньше" className="grid min-h-11 min-w-11 place-items-center text-lg" onClick={() => { setDone(false); setQty((n) => Math.max(1, n - 1)); }}>−</button>
            <span className="w-8 text-center font-semibold" aria-label={`Количество: ${qty}`}>{qty}</span>
            <button type="button" aria-label="Больше" className="grid min-h-11 min-w-11 place-items-center text-lg" onClick={() => { setDone(false); setQty((n) => Math.min(50, n + 1)); }}>+</button>
          </div>
        )}
        <button type="button" disabled={picked.length === 0} data-mix-add
          onClick={() => { onAdd({ mix: { sizeId: size.id, ingredientIds: picked.map((i) => i.id) }, price, sizeName: size.name, names: picked.map((i) => i.name) }, qty); setDone(true); if (skin === "pos") { setChosen([]); setDone(false); } }}
          className={k.add}>
          {picked.length === 0 ? "Выберите ингредиенты" : `${addLabel} · ${sum(price * qty)}`}
        </button>
      </div>
      {done && <p role="status" className="text-sm font-semibold text-forest">Добавлено. Можно собрать ещё один микс или перейти в корзину.</p>}
    </div>
  );
}
