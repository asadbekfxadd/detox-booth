import Link from "next/link";
import { sum } from "@/lib/format";
import { toneClass } from "@/lib/tone";
import type { PublicProduct } from "@/services/catalog";
import { ProductImage } from "./ProductImage";
import { QuickAdd } from "./QuickAdd";

const tag = "rounded-full bg-lime-soft px-2.5 py-0.5 text-[11px] font-semibold text-leaf-deep";

/** Карточка позиции: арка с фото, название, КБЖУ-метки и цена с быстрым добавлением. */
export function ProductCard({ p, priority = false }: { p: PublicProduct; priority?: boolean }) {
  const customizable = p.modifiers.length > 0;
  return (
    <article className={`${toneClass(p.category.slug)} group flex flex-col ${p.available ? "" : "opacity-70"}`}>
      <Link href={`/menu/${p.slug}`} className="block" aria-label={p.name}>
        <ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority={priority} className="transition-transform duration-300 group-hover:-translate-y-1" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 px-1 pt-3">
        <p className="text-sm font-semibold text-(--tone-deep)">{p.category.name}</p>
        <Link href={`/menu/${p.slug}`} className="text-[17px] font-bold leading-snug hover:underline">{p.name}</Link>
        <div className="flex flex-wrap gap-1.5">
          {p.isVegan && <span className={tag}>Веган</span>}
          {p.isHighProtein && <span className={tag}>Белок</span>}
          {p.isSugarFree && <span className={tag}>Без сахара</span>}
          {p.calories != null && <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted">{p.calories} ккал</span>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <div>
            <p className="display whitespace-nowrap text-sm font-bold leading-none sm:text-[17px]">{sum(p.defaultPrice)}</p>
            {customizable && p.available && <Link href={`/menu/${p.slug}`} className="mt-1 inline-block text-xs text-muted underline hover:text-ink">Настроить</Link>}
          </div>
          <QuickAdd productId={p.id} optionIds={p.defaultOptionIds} available={p.available} name={p.name} />
        </div>
      </div>
    </article>
  );
}
