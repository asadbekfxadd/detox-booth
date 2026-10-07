import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { listMenu, listCategories, popularIds } from "@/services/catalog";
import { sum } from "@/lib/format";
import { categoryEmoji } from "@/lib/emoji";
import { toneClass } from "@/lib/tone";
import { ProductCard } from "@/components/site/ProductCard";
import { ProductImage } from "@/components/site/ProductImage";
import { Marquee } from "@/components/site/Marquee";
import { SpinBadge } from "@/components/site/SpinBadge";
import { Lucky } from "@/components/site/Lucky";

export const dynamic = "force-dynamic";

const MOODS = [
  { t: "Бодрость с утра", d: "Смузи на фруктах", href: "/menu?category=smoothies", bg: "bg-mango text-night" },
  { t: "После тренировки", d: "Много белка", href: "/menu?diet=protein", bg: "bg-pom text-white" },
  { t: "Лёгкое и свежее", d: "Без сахара", href: "/menu?diet=sugarfree", bg: "bg-leaf text-night" },
  { t: "Сытный обед", d: "Боулы и салаты", href: "/menu?category=bowls", bg: "bg-magenta text-white" },
  { t: "Только растения", d: "Веган-меню", href: "/menu?diet=vegan", bg: "bg-neon text-night" },
  { t: "Выгодно", d: "Сеты со скидкой", href: "/menu?category=sets", bg: "bg-berry text-white" },
] as const;

const STEPS = [
  ["Выберите точку и блюда", "В меню видно только то, что сейчас есть на выбранной точке."],
  ["Оформите заказ", "Имя и телефон. Самовывоз или доставка, оплата при получении."],
  ["Заберите готовым", "Страница заказа сама покажет, когда всё собрано."],
] as const;

const Arrow = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"><path d="M7 17L17 7M8 7h9v9" /></svg>
);

export default async function HomePage() {
  const { locations, current } = await getSiteLocation();
  const [menu, cats, pop] = await Promise.all([listMenu(current?.id ?? null), listCategories(), popularIds()]);
  const sellable = menu.filter((p) => p.available);
  const popular = pop ? pop.map((id) => sellable.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p) : [];
  const featured = (popular.length >= 4 ? popular : sellable).slice(0, 8);
  const heroItems = cats.map((c) => sellable.find((p) => p.category.id === c.id && p.image)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 3);
  const cover = (catId: string) => sellable.find((p) => p.category.id === catId && p.image) ?? null;
  const setItems = sellable.filter((p) => p.category.slug === "sets").slice(0, 3);

  return (
    <div>
      {/* Главный экран */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="orb orb-a -left-24 -top-24 -z-10 h-[26rem] w-[26rem] bg-neon/40" />
        <div aria-hidden className="orb orb-b -right-20 top-10 -z-10 h-[24rem] w-[24rem] bg-magenta/40" />
        <div aria-hidden className="orb orb-a bottom-[-8rem] left-[35%] -z-10 h-[22rem] w-[22rem] bg-berry/45" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:pb-24">
          <div className="relative">
            <h1 className="text-[clamp(2.4rem,6.4vw,5.2rem)] font-black leading-[0.98]">
              Смузи, боулы и фреши
              <span className="mt-3 block"><span className="inline-block -rotate-1 rounded-xl bg-neon px-3 py-1 text-night">пока вы ждёте</span></span>
            </h1>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-white/75">Готовим сразу после заказа из свежих фруктов и овощей. У каждой позиции указаны состав, граммовка и калорийность.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/menu" className="btn btn-lime pop text-lg">Смотреть меню</Link>
              {cats.some((c) => c.slug === "sets") && <Link href="/menu?category=sets" className="btn btn-white pop">Сеты со скидкой</Link>}
            </div>
          </div>

          <div className="relative">
            <SpinBadge className="absolute -top-6 right-0 z-10 h-28 w-28 rounded-full bg-neon text-night shadow-[0_0_60px_-10px_#c6ff2b] sm:-top-10 sm:h-36 sm:w-36 lg:-right-2" />
            {heroItems.length === 3 ? (
              <div className="grid grid-cols-[1.15fr_1fr] gap-3 pt-8 sm:gap-4">
                {heroItems.map((p, i) => (
                  <Link key={p.id} href={`/menu/${p.slug}`} className={`${toneClass(p.category.slug)} arch-rise group relative block ${i === 0 ? "row-span-2" : ""} ${i === 2 ? "sm:translate-x-3" : ""}`}>
                    <ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority className={`${i === 0 ? "aspect-[3/4]!" : "aspect-square!"} ring-1 ring-white/20 shadow-[0_24px_60px_-24px_var(--tone)] transition-transform duration-300 group-hover:scale-[1.02]`} />
                    <span className="display absolute bottom-3 left-3 right-3 truncate rounded-lg bg-night/85 px-3 py-2 text-[11px] font-bold leading-tight backdrop-blur sm:text-xs">
                      {p.name} <span className="text-(--tone)">{sum(p.defaultPrice)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-8">
                {["smoothies", "bowls"].map((s) => <div key={s} className="arch-rise"><ProductImage image={null} name="" categorySlug={s} className="aspect-[3/4]!" /></div>)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Две пересекающиеся бегущие строки */}
      <div className="relative overflow-hidden py-8 sm:py-12">
        <Marquee items={["Свежевыжатые соки", "Смузи на выбор", "Боулы с асаи", "Салаты с киноа", "Детокс-шоты"]} className="-ml-[5%] w-[110%] -rotate-1 bg-neon text-night" />
        <Marquee reverse items={["Без сахара", "Много белка", "Только растения", "Готовим при вас", "Сеты со скидкой"]} className="-ml-[5%] -mt-3 w-[110%] rotate-1 bg-magenta text-white" />
      </div>

      <div className="mx-auto max-w-6xl space-y-20 px-4 py-10 sm:space-y-28 sm:py-16">
        {/* Выбор по настроению */}
        <section aria-labelledby="mood">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="mood" className="text-3xl font-black sm:text-5xl">Что хочется сегодня?</h2>
            <Lucky slugs={sellable.map((p) => p.slug)} />
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {MOODS.map((m) => (
              <li key={m.t}>
                <Link href={m.href} className={`group flex h-full min-h-36 flex-col justify-between gap-6 rounded-3xl p-4 transition-transform duration-200 hover:-translate-y-1 sm:p-6 ${m.bg}`}>
                  <Arrow />
                  <span><span className="display block text-[17px] font-black leading-tight sm:text-2xl">{m.t}</span><span className="mt-1 block text-sm font-semibold opacity-75">{m.d}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Категории */}
        {cats.length > 0 && (
          <section aria-labelledby="cats">
            <h2 id="cats" className="mb-8 text-3xl font-black sm:text-5xl">Что готовим</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {cats.map((c) => {
                const item = cover(c.id);
                return (
                  <li key={c.id} className={toneClass(c.slug)}>
                    <Link href={`/menu?category=${c.slug}`} className="group relative block overflow-hidden rounded-3xl">
                      {item
                        ? <ProductImage image={item.image} name={c.name} categorySlug={c.slug} className="aspect-[4/5]! rounded-3xl! transition-transform duration-500 group-hover:scale-105" />
                        : <div className="grid aspect-[4/5] place-items-center rounded-3xl bg-(--tone) text-6xl text-night">{categoryEmoji(c.slug)}</div>}
                      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-night via-night/70 to-transparent p-4 pt-14">
                        <span className="display text-base font-black leading-tight sm:text-xl">{c.name}</span>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-(--tone) text-night transition-transform group-hover:rotate-45"><Arrow /></span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Популярное */}
        {featured.length > 0 && (
          <section aria-labelledby="top">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 id="top" className="text-3xl font-black sm:text-5xl">{popular.length >= 4 ? "Выбирают чаще всего" : "С чего начать"}</h2>
              <Link href="/menu" className="btn btn-white pop !px-4 !py-2 text-sm">Всё меню</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{featured.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div>
          </section>
        )}
      </div>

      {/* Сеты */}
      {setItems.length > 0 && (
        <section className="relative overflow-hidden bg-[linear-gradient(120deg,#7b3cff_0%,#c42fd6_55%,#ff2fa0_100%)] text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-4xl font-black leading-[1.02] sm:text-6xl">Сеты выгоднее, чем по отдельности</h2>
              <p className="mt-5 max-w-md text-lg text-white/90">Боул и напиток, детокс на весь день или завтрак для двоих. Цена уже со скидкой.</p>
              <Link href="/menu?category=sets" className="btn btn-lime mt-8 text-lg">Выбрать сет</Link>
            </div>
            <ul className="grid grid-cols-3 gap-3 sm:gap-5">
              {setItems.map((p, i) => (
                <li key={p.id} className={i === 1 ? "mt-8" : ""}>
                  <Link href={`/menu/${p.slug}`} className="group block">
                    <ProductImage image={p.image} name={p.name} categorySlug="sets" className="shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/30 transition-transform duration-300 group-hover:-translate-y-2" />
                    <p className="display mt-3 text-[11px] font-bold leading-tight sm:text-sm">{p.name}</p>
                    <p className="text-xs font-bold text-neon sm:text-sm">{sum(p.defaultPrice)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Как заказать */}
      <section aria-labelledby="how" className="bg-neon text-night">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <h2 id="how" className="text-3xl font-black sm:text-5xl">Как заказать</h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="border-t-2 border-night pt-4">
                <span className="display block text-7xl font-black leading-none text-night sm:text-8xl">{i + 1}</span>
                <p className="mt-4 text-xl font-black">{t}</p>
                <p className="mt-2 leading-relaxed text-night/75">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {locations.length > 0 && (
        <section aria-labelledby="where" className="mx-auto max-w-6xl px-4 py-14 sm:py-24">
          <h2 id="where" className="mb-8 text-3xl font-black sm:text-5xl">Наши точки</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((l) => (
              <li key={l.id} className={`rounded-3xl border p-6 ${current?.id === l.id ? "border-neon bg-neon/10" : "border-white/12 bg-surface"}`}>
                <p className="display text-lg font-extrabold">{l.name}</p>
                {l.address && <p className="mt-1 text-sm text-white/70">{l.address}</p>}
                {current?.id === l.id && <p className="mt-3 text-sm font-bold text-neon">Заказ оформляется на эту точку</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
