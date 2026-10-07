import Link from "next/link";
import { sum } from "@/lib/format";
import { toneClass } from "@/lib/tone";
import type { PublicProduct } from "@/services/catalog";
import { ProductImage } from "./ProductImage";
import { QuickAdd } from "./QuickAdd";

const tag = "rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/85";

/** Карточка позиции: тёмная поверхность с неоновым свечением цвета категории, фото, метки и цена с быстрым добавлением. */
export function ProductCard({ p, priority = false }: { p: PublicProduct; priority?: boolean }) {
  const customizable = p.modifiers.length > 0;
  return (
    <article className={`${toneClass(p.category.slug)} pop-card flex flex-col rounded-3xl p-2.5 sm:p-3 ${p.available ? "" : "opacity-70"}`}>
      <Link href={`/menu/${p.slug}`} className="block" aria-label={p.name}>
        <ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority={priority} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 px-1 pb-1 pt-3">
        <Link href={`/menu/${p.slug}`} className="display text-[15px] font-bold leading-snug hover:text-(--tone) sm:text-base">{p.name}</Link>
        <div className="flex flex-wrap gap-1.5">
          {p.isVegan && <span className={tag}>Веган</span>}
          {p.isHighProtein && <span className={tag}>Белок</span>}
          {p.isSugarFree && <span className={tag}>Без сахара</span>}
          {p.calories != null && <span className={`${tag} bg-transparent ring-1 ring-white/20`}>{p.calories} ккал</span>}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="display whitespace-nowrap text-[15px] font-extrabold leading-none text-(--tone) sm:text-lg">{sum(p.defaultPrice)}</p>
            {customizable && p.available && <Link href={`/menu/${p.slug}`} className="mt-1.5 inline-block text-xs font-semibold text-white/60 underline hover:text-white">Настроить</Link>}
          </div>
          <QuickAdd productId={p.id} optionIds={p.defaultOptionIds} available={p.available} name={p.name} />
        </div>
      </div>
    </article>
  );
}
