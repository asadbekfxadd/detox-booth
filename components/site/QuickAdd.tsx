"use client";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";

/** Кнопка «+» на карточке: кладёт позицию в корзину с настройками по умолчанию. Цвет берёт у категории. */
export function QuickAdd({ productId, optionIds, available, name }: { productId: string; optionIds: string[]; available: boolean; name?: string }) {
  const add = useCart((s) => s.add);
  const [done, setDone] = useState(false);
  if (!available) return <span className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white/50">Нет в наличии</span>;
  return (
    <button type="button" aria-label={done ? "Добавлено в корзину" : `Добавить в корзину${name ? `: ${name}` : ""}`}
      onClick={() => { add({ productId, quantity: 1, optionIds }); setDone(true); setTimeout(() => setDone(false), 1400); }}
      className={`press grid h-11 w-11 place-items-center rounded-xl text-2xl font-black text-night ${done ? "bg-white" : "bg-(--tone,#c6ff2b)"}`}>
      <span aria-hidden>{done ? "✓" : "+"}</span>
    </button>
  );
}
