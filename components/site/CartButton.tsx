"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-store";

export function CartButton() {
  const count = useCart((s) => s.lines.reduce((a, l) => a + l.quantity, 0));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const n = mounted ? count : 0;
  return (
    <Link href="/cart" aria-label={n > 0 ? `Корзина, позиций: ${n}` : "Корзина"} className="btn btn-lime pop pop-sm !px-4 !py-2.5 text-sm">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7V6a3 3 0 0 1 6 0v1" /></svg>
      <span className="hidden sm:inline">Корзина</span>
      {n > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1.5 text-xs font-bold text-lime">{n}</span>}
    </Link>
  );
}
