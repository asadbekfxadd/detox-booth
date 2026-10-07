"use client";
import { useRouter } from "next/navigation";
import { useCart, type CartLine } from "@/lib/cart-store";

/** «Повторить заказ»: кладёт те же позиции в корзину. Цены и наличие корзина перепроверит на сервере. */
export function RepeatOrder({ lines, className = "btn btn-primary pop", label = "Повторить заказ" }: { lines: CartLine[]; className?: string; label?: string }) {
  const add = useCart((s) => s.add);
  const router = useRouter();
  return (
    <button type="button" className={className} onClick={() => { for (const l of lines) add(l); router.push("/cart"); }}>
      {label}
    </button>
  );
}
