import Link from "next/link";
import { sum } from "@/lib/format";
import { toneClass } from "@/lib/tone";
import type { PublicProduct } from "@/services/catalog";
import { ProductImage } from "./ProductImage";
import { QuickAdd } from "./QuickAdd";

const tag = "rounded-full bg-forest/8 px-2.5 py-0.5 text-[11px] font-bold text-forest";

/** Карточка позиции: белая карточка со свечением цвета категории, фото, метки и цена с быстрым добавлением. */
export function ProductCard({ p, priority = false }: { p: PublicProduct; priority?: boolean }) {
  const customizable = p.modifiers.length > 0;
  return (
    <article data-product={p.slug} className={`${toneClass(p.category.slug)} pop-card flex flex-col rounded-3xl p-2.5 sm:p-3 ${p.available ? "" : "opacity-70"}`}>
      <Link href={`/menu/${p.slug}`} className="relative block" aria-label={p.videoUrl ? `${p.name}, есть видео, как готовим` : p.name}>
        <ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority={priority} />
        {p.videoUrl && (
          <span aria-hidden className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-forest-deep/85 py-1 pl-1 pr-2.5 text-[11px] font-extrabold text-white backdrop-blur">
            <span className="grid size-5 place-items-center rounded-full bg-orange text-forest-deep"><svg viewBox="0 0 24 24" className="size-3 translate-x-px" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>Видео
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 px-1 pb-1 pt-3">
        <Link href={`/menu/${p.slug}`} className="display text-[15px] font-bold leading-snug hover:text-orange-deep sm:text-base">{p.name}</Link>
        <div className="flex flex-wrap gap-1.5">
          {p.isVegan && <span className={tag}>Веган</span>}
          {p.isHighProtein && <span className={tag}>Белок</span>}
          {p.isSugarFree && <span className={tag}>Без сахара</span>}
          {p.calories != null && <span className={`${tag} bg-transparent ring-1 ring-forest/20`}>{p.calories} ккал</span>}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="display whitespace-nowrap text-[15px] font-extrabold leading-none text-forest sm:text-lg">
              {sum(p.defaultPrice)}
              {p.oldDefaultPrice != null && <s className="ml-1.5 text-xs font-semibold text-forest/50">{sum(p.oldDefaultPrice)}</s>}
            </p>
            {p.happyPct > 0 && <p className="mt-1 text-[11px] font-bold text-orange-deep">Счастливые часы −{p.happyPct}%</p>}
            {customizable && p.available && <Link href={`/menu/${p.slug}`} className="mt-1.5 inline-block text-xs font-semibold text-forest/60 underline hover:text-orange-deep">Настроить</Link>}
          </div>
          <QuickAdd productId={p.id} optionIds={p.defaultOptionIds} available={p.available} soon={p.comingSoon} name={p.name} />
        </div>
      </div>
    </article>
  );
}
