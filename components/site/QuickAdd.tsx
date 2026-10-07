"use client";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";

/** Круглая кнопка «+» на карточке: кладёт позицию в корзину с настройками по умолчанию. */
export function QuickAdd({ productId, optionIds, available, name }: { productId: string; optionIds: string[]; available: boolean; name?: string }) {
  const add = useCart((s) => s.add);
  const [done, setDone] = useState(false);
  if (!available) return <span className="rounded-full border-2 border-ink/40 bg-white/70 px-3 py-1.5 text-xs font-bold text-muted">Нет в наличии</span>;
  return (
    <button type="button" aria-label={done ? "Добавлено в корзину" : `Добавить в корзину${name ? `: ${name}` : ""}`}
      onClick={() => { add({ productId, quantity: 1, optionIds }); setDone(true); setTimeout(() => setDone(false), 1400); }}
      className={`pop pop-sm grid h-12 w-12 place-items-center rounded-full text-2xl font-black ${done ? "bg-lime text-ink" : "bg-ink text-lime"}`}>
      <span aria-hidden>{done ? "✓" : "+"}</span>
    </button>
  );
}
