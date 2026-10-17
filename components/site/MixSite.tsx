"use client";
import Link from "next/link";
import { useCart } from "@/lib/cart-store";
import { MixBuilder } from "@/components/mix/MixBuilder";
import type { MixCatalog } from "@/services/mix";

/** Конструктор микса на сайте: готовый набор кладём в корзину. Цену и состав при заказе пересчитает сервер. */
export function MixSite({ catalog }: { catalog: MixCatalog }) {
  const add = useCart((s) => s.add);
  return (
    <div className="space-y-4">
      <MixBuilder catalog={catalog} withQuantity onAdd={(p, quantity) => add({ productId: catalog.productId, quantity, optionIds: [], mix: p.mix })} />
      <p className="text-sm"><Link href="/cart" className="font-semibold underline">Перейти в корзину</Link></p>
    </div>
  );
}
