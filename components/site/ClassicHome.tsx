import Link from "next/link";
import type { Brand } from "@/lib/brand-config";
import type { PublicProduct } from "@/services/catalog";
import { categoryEmoji } from "@/lib/emoji";
import { toneClass } from "@/lib/tone";
import { ProductCard } from "@/components/site/ProductCard";
import { ProductImage } from "@/components/site/ProductImage";

const STEPS = [
  ["Выберите блюда", "В меню видно только то, что сейчас есть на выбранной точке."],
  ["Оформите заказ", "Имя и телефон. Самовывоз или доставка, оплата при получении или онлайн."],
  ["Получите готовым", "Страница заказа сама покажет, когда всё собрано."],
] as const;

/** Универсальная главная: название, фото, категории, популярное и три шага заказа. Работает для любого заведения. */
export function ClassicHome({ brand, menu, cats, popular }: {
  brand: Brand; menu: PublicProduct[]; cats: { id: string; name: string; slug: string }[]; popular: string[] | null;
}) {
  const sellable = menu.filter((p) => p.available);
  const hits = popular ? popular.map((id) => sellable.find((p) => p.id === id)).filter((p): p is PublicProduct => !!p) : [];
  const featured = (hits.length >= 4 ? hits : sellable).slice(0, 8);
  const cover = (catId: string) => sellable.find((p) => p.category.id === catId && p.image) ?? null;

  return (
    <div>
      <section className="relative isolate overflow-hidden bg-[radial-gradient(70%_80%_at_85%_30%,var(--color-sand)_0%,var(--color-cream)_75%)]">
        <div className={`mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:pt-16 ${brand.heroImage ? "lg:grid-cols-[1.05fr_1fr]" : ""}`}>
          <div>
            {brand.tagline && <p className="script text-3xl text-orange-deep sm:text-4xl">{brand.tagline}</p>}
            <h1 className="mt-2 text-[clamp(2.3rem,5.6vw,4.6rem)] font-black text-forest">{brand.heroTitle || brand.name}</h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-forest/75">{brand.heroText || "Закажите онлайн и заберите готовым. Или закажите за столом по QR-коду."}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/menu" className="btn btn-primary text-lg">Смотреть меню</Link>
              <Link href="/locations" className="btn btn-ghost">Где нас найти</Link>
            </div>
          </div>
          {brand.heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.heroImage} alt="" className="aspect-[10/8] w-full rounded-[2rem] object-cover shadow-xl" />
          )}
        </div>
      </section>

      {cats.length > 0 && (
        <section aria-labelledby="cats" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 id="cats" className="mb-6 text-3xl font-black sm:text-4xl">Меню</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {cats.map((c) => {
              const p = cover(c.id);
              return (
                <li key={c.id}>
                  <Link href={`/menu?category=${c.slug}`} className={`${toneClass(c.slug)} pop-card group block rounded-3xl p-2.5 sm:p-3`}>
                    <ProductImage image={p?.image ?? null} name={c.name} categorySlug={c.slug} shape="wide" />
                    <p className="display px-1 pb-1 pt-3 text-base font-extrabold group-hover:text-orange-deep"><span aria-hidden>{categoryEmoji(c.slug)} </span>{c.name}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {featured.length > 0 && (
        <section aria-labelledby="hits" className="mx-auto max-w-6xl px-4 pb-12 sm:pb-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 id="hits" className="text-3xl font-black sm:text-4xl">{hits.length >= 4 ? "Хиты" : "Из меню"}</h2>
            <Link href="/menu" className="font-bold text-orange-deep underline underline-offset-4">Всё меню</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{featured.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div>
        </section>
      )}

      <section aria-labelledby="how" className="bg-sand">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 id="how" className="mb-8 text-3xl font-black sm:text-4xl">Как заказать</h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest text-lg font-black text-white">{i + 1}</span>
                <div><p className="text-lg font-extrabold">{t}</p><p className="mt-1 leading-relaxed text-forest/70">{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
