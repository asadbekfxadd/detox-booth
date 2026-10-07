"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { sum } from "@/lib/format";
import type { PublicProduct } from "@/services/catalog";

/** Выбор опций с мгновенным пересчётом цены. Итог в корзине всё равно пересчитает сервер. */
export function Configurator({ p }: { p: PublicProduct }) {
  const add = useCart((s) => s.add);
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const m of p.modifiers) init[m.id] = m.required && !m.multiple && m.options[0] ? [m.options[0].id] : [];
    return init;
  });
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const optionIds = useMemo(() => Object.values(sel).flat(), [sel]);
  const unit = useMemo(() => p.price + p.modifiers.flatMap((m) => m.options).filter((o) => optionIds.includes(o.id)).reduce((a, o) => a + o.priceDelta, 0), [p, optionIds]);
  const missing = p.modifiers.find((m) => m.required && (sel[m.id] ?? []).length === 0);

  function pick(mid: string, oid: string, multiple: boolean, required: boolean) {
    setAdded(false);
    setSel((s) => {
      const cur = s[mid] ?? [];
      if (multiple) return { ...s, [mid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
      return { ...s, [mid]: cur.includes(oid) && !required ? [] : [oid] };
    });
  }

  const maxQty = p.portions === null ? 50 : Math.min(50, Math.max(1, p.portions));
  return (
    <div className="space-y-5">
      {p.modifiers.map((m) => (
        <fieldset key={m.id}>
          <legend className="mb-2 text-sm font-semibold">{m.name}{m.required ? "" : " (по желанию)"}{m.multiple && " · можно несколько"}</legend>
          <div className="flex flex-wrap gap-2">
            {m.options.map((o) => {
              const on = (sel[m.id] ?? []).includes(o.id);
              return (
                <button key={o.id} type="button" aria-pressed={on} onClick={() => pick(m.id, o.id, m.multiple, m.required)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
                  {o.name}{o.priceDelta !== 0 && <span className="ml-1 opacity-75">{o.priceDelta > 0 ? "+" : "−"}{sum(Math.abs(o.priceDelta))}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center rounded-full border border-line bg-white">
          <button type="button" aria-label="Меньше" className="px-4 py-2 text-lg" onClick={() => { setAdded(false); setQty((q) => Math.max(1, q - 1)); }}>−</button>
          <span className="w-8 text-center font-semibold">{qty}</span>
          <button type="button" aria-label="Больше" className="px-4 py-2 text-lg" onClick={() => { setAdded(false); setQty((q) => Math.min(maxQty, q + 1)); }}>+</button>
        </div>
        <button type="button" disabled={!p.available || !!missing}
          onClick={() => { add({ productId: p.id, quantity: qty, optionIds }); setAdded(true); }}
          className="rounded-full bg-ink px-6 py-3 font-semibold text-white hover:bg-leaf disabled:cursor-not-allowed disabled:bg-line disabled:text-muted">
          {!p.available ? "Нет в наличии" : `В корзину · ${sum(unit * qty)}`}
        </button>
      </div>
      {missing && <p className="text-sm text-red-700">Выберите «{missing.name}»</p>}
      {added && <p className="text-sm text-leaf">Добавлено в корзину. <Link href="/cart" className="font-semibold underline">Перейти в корзину</Link></p>}
      {p.portions !== null && p.portions > 0 && p.portions <= 5 && <p className="text-sm text-amber-700">Осталось всего {p.portions} шт. на этой точке</p>}
    </div>
  );
}
