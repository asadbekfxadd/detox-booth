import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { listMenu, listCategories, popularIds } from "@/services/catalog";
import { sum } from "@/lib/format";
import { categoryEmoji } from "@/lib/emoji";
import { toneClass } from "@/lib/tone";
import { ProductCard } from "@/components/site/ProductCard";
import { ProductImage } from "@/components/site/ProductImage";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Выберите точку и блюда", "В меню видно только то, что сейчас есть на выбранной точке."],
  ["Оформите заказ", "Имя и телефон. Самовывоз или доставка, оплата при получении."],
  ["Заберите готовым", "Страница заказа сама покажет, когда всё собрано."],
] as const;

export default async function HomePage() {
  const { locations, current } = await getSiteLocation();
  const [menu, cats, pop] = await Promise.all([listMenu(current?.id ?? null), listCategories(), popularIds()]);
  const sellable = menu.filter((p) => p.available);
  const popular = pop ? pop.map((id) => sellable.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p) : [];
  const featured = (popular.length >= 4 ? popular : sellable).slice(0, 8);
  // Три арки в главном экране: разные категории, лучше всего с фото.
  const heroItems = cats.map((c) => sellable.find((p) => p.category.id === c.id && p.image)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 3);
  const cover = (catId: string) => sellable.find((p) => p.category.id === catId && p.image) ?? null;

  return (
    <div className="space-y-16 sm:space-y-20">
      <section className="grid items-end gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
        <div className="pb-2 lg:pb-10">
          <h1 className="text-[clamp(1.9rem,4.6vw,3.2rem)] font-extrabold leading-[1.08]">Смузи, боулы и фреши, пока вы ждёте</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">Готовим сразу после заказа из свежих фруктов и овощей. У каждой позиции указаны состав, граммовка и калорийность.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/menu" className="rounded-full bg-ink px-7 py-3.5 font-bold text-white transition-colors hover:bg-leaf">Смотреть меню</Link>
            {cats.some((c) => c.slug === "sets") && <Link href="/menu?category=sets" className="rounded-full border-2 border-ink px-7 py-3 font-bold transition-colors hover:bg-lime">Сеты со скидкой</Link>}
          </div>
        </div>

        {heroItems.length > 0 ? (
          <div className="grid grid-cols-3 items-end gap-3 sm:gap-4" aria-hidden={false}>
            {heroItems.map((p, i) => (
              <Link key={p.id} href={`/menu/${p.slug}`} className={`arch-rise relative block ${i === 1 ? "pb-0" : i === 0 ? "pb-8 sm:pb-14" : "pb-4 sm:pb-8"}`}>
                <ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority className="aspect-[3/5]!" />
                {i === 0 && (
                  <span className="display absolute -left-1 bottom-3 rotate-[-6deg] rounded-xl bg-pom px-3 py-1.5 text-[11px] font-bold leading-tight text-white shadow-md sm:bottom-6 sm:text-xs">
                    {p.name}<br />{sum(p.defaultPrice)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 items-end gap-3">
            {["smoothies", "bowls", "fresh"].map((s, i) => <div key={s} className={`arch-rise ${i === 1 ? "" : "pb-8"}`}><ProductImage image={null} name="" categorySlug={s} className="aspect-[3/5]!" /></div>)}
          </div>
        )}
      </section>

      {cats.length > 0 && (
        <section aria-labelledby="cats">
          <h2 id="cats" className="mb-5 text-2xl font-bold sm:text-3xl">Что готовим</h2>
          <ul className="grid grid-cols-4 gap-x-2.5 gap-y-5 sm:gap-x-3 lg:grid-cols-8">
            {cats.map((c) => {
              const item = cover(c.id);
              return (
                <li key={c.id} className={toneClass(c.slug)}>
                  <Link href={`/menu?category=${c.slug}`} className="group block text-center">
                    {item
                      ? <ProductImage image={item.image} name={c.name} categorySlug={c.slug} className="aspect-[4/5]! transition-transform duration-300 group-hover:-translate-y-1" />
                      : <div className="arch grid aspect-[4/5] place-items-center bg-(--tone) text-5xl">{categoryEmoji(c.slug)}</div>}
                    <span className="mt-2 block text-xs font-bold leading-tight group-hover:underline sm:text-base">{c.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {featured.length > 0 && (
        <section aria-labelledby="top">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 id="top" className="text-2xl font-bold sm:text-3xl">{popular.length >= 4 ? "Выбирают чаще всего" : "С чего начать"}</h2>
            <Link href="/menu" className="shrink-0 text-sm font-semibold underline decoration-2 underline-offset-4 hover:text-leaf">Всё меню</Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{featured.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div>
        </section>
      )}

      <section aria-labelledby="how" className="rounded-[2rem] bg-leaf-deep p-6 text-white sm:p-10">
        <h2 id="how" className="text-2xl font-bold sm:text-3xl">Как заказать</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime font-bold text-ink">{i + 1}</span>
              <div><p className="font-bold">{t}</p><p className="mt-1 text-sm leading-relaxed text-white/75">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {locations.length > 0 && (
        <section aria-labelledby="where">
          <h2 id="where" className="mb-5 text-2xl font-bold sm:text-3xl">Наши точки</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((l) => (
              <li key={l.id} className={`rounded-2xl border-2 p-5 ${current?.id === l.id ? "border-ink bg-white" : "border-line bg-white/60"}`}>
                <p className="font-bold">{l.name}</p>
                {l.address && <p className="mt-1 text-sm text-muted">{l.address}</p>}
                {current?.id === l.id && <p className="mt-2 text-sm font-semibold text-leaf">Заказ оформляется на эту точку</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
