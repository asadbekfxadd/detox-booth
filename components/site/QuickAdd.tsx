"use client";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";

/** Кнопка «+» на карточке: кладёт позицию в корзину с настройками по умолчанию. Апельсиновая, после нажатия на секунду зелёная. */
export function QuickAdd({ productId, optionIds, available, name }: { productId: string; optionIds: string[]; available: boolean; name?: string }) {
  const add = useCart((s) => s.add);
  const [done, setDone] = useState(false);
  if (!available) return <span className="rounded-full border border-forest/20 px-3 py-1.5 text-xs font-bold text-forest/55">Скоро вернём</span>;
  return (
    <button type="button" aria-label={done ? "Добавлено в корзину" : `Добавить в корзину${name ? `: ${name}` : ""}`}
      onClick={() => { add({ productId, quantity: 1, optionIds }); setDone(true); setTimeout(() => setDone(false), 1400); }}
      className={`press grid h-11 w-11 place-items-center rounded-full text-2xl font-black ${done ? "bg-forest text-white" : "bg-linear-to-br from-sun to-orange text-forest-deep"}`}>
      <span aria-hidden>{done ? "✓" : "+"}</span>
    </button>
  );
}
