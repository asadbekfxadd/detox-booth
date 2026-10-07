"use client";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";

/** Круглая кнопка «+» на карточке: кладёт позицию в корзину с настройками по умолчанию. */
export function QuickAdd({ productId, optionIds, available, name }: { productId: string; optionIds: string[]; available: boolean; name?: string }) {
  const add = useCart((s) => s.add);
  const [done, setDone] = useState(false);
  if (!available) return <span className="rounded-full bg-line px-3 py-1.5 text-xs font-semibold text-muted">Нет в наличии</span>;
  return (
    <button type="button" aria-label={done ? "Добавлено в корзину" : `Добавить в корзину${name ? `: ${name}` : ""}`}
      onClick={() => { add({ productId, quantity: 1, optionIds }); setDone(true); setTimeout(() => setDone(false), 1400); }}
      className={`grid h-11 w-11 place-items-center rounded-full text-xl font-bold transition-colors ${done ? "bg-lime text-ink" : "bg-ink text-white hover:bg-leaf"}`}>
      <span aria-hidden>{done ? "✓" : "+"}</span>
    </button>
  );
}
