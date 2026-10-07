"use client";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";

export function QuickAdd({ productId, optionIds, available }: { productId: string; optionIds: string[]; available: boolean }) {
  const add = useCart((s) => s.add);
  const [done, setDone] = useState(false);
  return (
    <button disabled={!available}
      onClick={() => { add({ productId, quantity: 1, optionIds }); setDone(true); setTimeout(() => setDone(false), 1200); }}
      className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-neutral-300">
      {!available ? "Нет в наличии" : done ? "Добавлено ✓" : "В корзину"}
    </button>
  );
}
