"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WarehouseTab } from "@/components/admin/warehouse-tabs";

/**
 * Вкладки раздела «Склад»: продукты и остатки, закупки, поставщики, списания, партии, расхождения.
 * Показываются только на страницах склада. Активна вкладка с самым длинным подходящим адресом,
 * поэтому приход, перемещение и редактирование ингредиента остаются внутри «Продукты и остатки».
 */
export function WarehouseTabs({ tabs }: { tabs: WarehouseTab[] }) {
  const path = usePathname();
  const hit = (m: string) => path === m || path.startsWith(m + "/");
  let active: WarehouseTab | null = null, best = -1;
  for (const t of tabs) for (const m of t.match) if (hit(m) && m.length > best) { best = m.length; active = t; }
  if (!active) return null;
  return (
    <nav aria-label="Склад" className="-mt-2 mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200 print:hidden">
      {tabs.map((t) => {
        const on = t === active;
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm ${on ? "border-green-700 font-semibold text-green-900" : "border-transparent text-neutral-600 hover:text-neutral-900"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
