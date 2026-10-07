import Link from "next/link";
import { money } from "@/lib/format";
import type { PublicProduct } from "@/services/catalog";
import { ProductImage } from "./ProductImage";
import { QuickAdd } from "./QuickAdd";

const chip = "rounded-full bg-lime-100 px-2 py-0.5 text-[11px] font-semibold text-green-900";

export function ProductCard({ p }: { p: PublicProduct }) {
  const hasChoice = p.modifiers.length > 0;
  return (
    <div className={`flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ${p.available ? "" : "opacity-70"}`}>
      <Link href={`/menu/${p.slug}`}><ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} /></Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1">
          {p.isVegan && <span className={chip}>Веган</span>}
          {p.isHighProtein && <span className={chip}>Белок</span>}
          {p.isSugarFree && <span className={chip}>Без сахара</span>}
          {p.calories != null && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">{p.calories} ккал</span>}
        </div>
        <Link href={`/menu/${p.slug}`} className="text-lg font-bold leading-tight hover:underline">{p.name}</Link>
        {p.description && <p className="line-clamp-2 text-sm text-neutral-500">{p.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <p className="font-bold">{hasChoice && "от "}{money(p.defaultPrice)}</p>
          {hasChoice
            ? <Link href={`/menu/${p.slug}`} className="rounded-full border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-lime-50">{p.available ? "Выбрать" : "Нет в наличии"}</Link>
            : <QuickAdd productId={p.id} optionIds={p.defaultOptionIds} available={p.available} />}
        </div>
      </div>
    </div>
  );
}
