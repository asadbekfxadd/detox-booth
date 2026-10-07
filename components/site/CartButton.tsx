"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-store";

export function CartButton() {
  const count = useCart((s) => s.lines.reduce((a, l) => a + l.quantity, 0));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Link href="/cart" className="relative rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
      Корзина{mounted && count > 0 && <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-green-800">{count}</span>}
    </Link>
  );
}
