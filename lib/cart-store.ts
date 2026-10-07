"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = { productId: string; quantity: number; optionIds: string[] };
export const lineKey = (l: Pick<CartLine, "productId" | "optionIds">) => `${l.productId}|${[...l.optionIds].sort().join(",")}`;

type State = {
  lines: CartLine[];
  add: (l: CartLine) => void;
  setQty: (key: string, q: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

/** В браузере хранятся только id, опции и количество. Цены и наличие всегда считает сервер. */
export const useCart = create<State>()(persist((set) => ({
  lines: [],
  add: (l) => set((s) => {
    const k = lineKey(l);
    const ex = s.lines.find((x) => lineKey(x) === k);
    return { lines: ex ? s.lines.map((x) => (lineKey(x) === k ? { ...x, quantity: Math.min(50, x.quantity + l.quantity) } : x)) : [...s.lines, { ...l, quantity: Math.min(50, l.quantity) }] };
  }),
  setQty: (key, q) => set((s) => ({ lines: s.lines.map((x) => (lineKey(x) === key ? { ...x, quantity: Math.max(1, Math.min(50, q)) } : x)) })),
  remove: (key) => set((s) => ({ lines: s.lines.filter((x) => lineKey(x) !== key) })),
  clear: () => set({ lines: [] }),
}), {
  name: "detox-cart",
  version: 1,
  // при смене формата старая корзина сбрасывается, а не ломает страницу
  migrate: () => ({ lines: [] }) as unknown as State,
}));
