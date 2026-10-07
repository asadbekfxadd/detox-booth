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
  { t: "Бодрость с утра", d: "Смузи на фруктах", href: "/menu?category=smoothies", e: "🥭", bg: "bg-mango" },
  { t: "После тренировки", d: "Много белка", href: "/menu?diet=protein", e: "💪", bg: "bg-pom text-white" },
  { t: "Лёгкое и свежее", d: "Без сахара", href: "/menu?diet=sugarfree", e: "🥬", bg: "bg-[#8fd96b]" },
  { t: "Сытный обед", d: "Боулы и салаты", href: "/menu?category=bowls", e: "🥣", bg: "bg-[#ff8fb3]" },
  { t: "Только растения", d: "Веган-меню", href: "/menu?diet=vegan", e: "🌱", bg: "bg-lime" },
  { t: "Выгодно", d: "Сеты со скидкой", href: "/menu?category=sets", e: "🎁", bg: "bg-[#a99bff]" },
] as const;

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
  const heroItems = cats.map((c) => sellable.find((p) => p.category.id === c.id && p.image)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 3);
  const cover = (catId: string) => sellable.find((p) => p.category.id === catId && p.image) ?? null;
  const setItems = sellable.filter((p) => p.category.slug === "sets").slice(0, 3);
  const tones = ["bg-mango", "bg-pom", "bg-berry"];

  return (
    <div>
      {/* Главный экран */}
      <section className="relative overflow-hidden border-b-2 border-ink bg-lime">
        <span aria-hidden className="float absolute left-[1%] top-[5%] text-5xl [--r:-12deg] sm:text-6xl">🍓</span>
        <span aria-hidden className="float float-2 absolute right-[3%] top-[8%] hidden text-6xl [--r:10deg] sm:block">🍊</span>
        <span aria-hidden className="float float-3 absolute bottom-[6%] left-[44%] hidden text-5xl [--r:-6deg] md:block">🥭</span>
        <div className="mx-auto grid max-w-6xl items-end gap-8 px-4 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-4">
          <div className="relative pb-10 lg:pb-16">
            <h1 className="text-[clamp(2rem,5vw,3.6rem)] font-black leading-[1.05]">Смузи, боулы и фреши, пока вы ждёте</h1>
            <p className="mt-5 max-w-md text-lg font-medium leading-relaxed">Готовим сразу после заказа из свежих фруктов и овощей. У каждой позиции указаны состав, граммовка и калорийность.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/menu" className="btn btn-ink pop">Смотреть меню</Link>
              {cats.some((c) => c.slug === "sets") && <Link href="/menu?category=sets" className="btn btn-white pop">Сеты со скидкой</Link>}
            </div>
          </div>

          <div className="relative">
            <SpinBadge className="absolute -top-2 right-0 z-10 h-28 w-28 rotate-6 rounded-full border-2 border-ink bg-white text-ink shadow-[4px_4px_0_0_#14231a] sm:-top-6 sm:h-36 sm:w-36 lg:right-2" />
            {heroItems.length > 0 ? (
              <div className="grid grid-cols-3 items-end gap-3 pt-14 sm:gap-4 sm:pt-20">
                {heroItems.map((p, i) => (
                  <Link key={p.id} href={`/menu/${p.slug}`} className={`arch-rise relative block ${i === 1 ? "" : i === 0 ? "pb-10 sm:pb-16" : "pb-5 sm:pb-9"}`}>
                    <ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority className={`aspect-[3/5]! ${tones[i]} shadow-[5px_5px_0_0_#14231a]`} />
                    {i === 0 && (
                      <span className="display absolute -left-2 bottom-4 rotate-[-6deg] rounded-xl border-2 border-ink bg-pom px-3 py-1.5 text-[11px] font-bold leading-tight text-white shadow-[3px_3px_0_0_#14231a] sm:bottom-10 sm:text-xs">
                        {p.name}<br />{sum(p.defaultPrice)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 items-end gap-3 pt-20">
                {["smoothies", "bowls", "fresh"].map((s, i) => <div key={s} className={`arch-rise ${i === 1 ? "" : "pb-8"}`}><ProductImage image={null} name="" categorySlug={s} className="aspect-[3/5]!" /></div>)}
              </div>
            )}
          </div>
        </div>
      </section>

      <Marquee items={["Свежевыжатые соки", "Смузи на выбор", "Боулы с асаи", "Салаты с киноа", "Детокс-шоты", "Сеты со скидкой"]} className="border-b-2 border-ink bg-ink text-lime" />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:space-y-20 sm:py-20">
        {/* Выбор по настроению */}
        <section aria-labelledby="mood">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 id="mood" className="text-2xl font-extrabold sm:text-4xl">Что хочется сегодня?</h2>
            <Lucky slugs={sellable.map((p) => p.slug)} />
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {MOODS.map((m, i) => (
              <li key={m.t}>
                <Link href={m.href} className={`pop group flex h-full min-h-32 items-center justify-between gap-3 rounded-3xl p-4 sm:p-5 ${m.bg} ${i % 2 ? "sm:-rotate-1" : "sm:rotate-1"} hover:rotate-0`}>
                  <span><span className="display block text-[15px] font-extrabold leading-tight sm:text-xl">{m.t}</span><span className="mt-1 block text-sm font-semibold opacity-80">{m.d}</span></span>
                  <span aria-hidden className="text-4xl transition-transform group-hover:scale-125 sm:text-6xl">{m.e}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Категории */}
        {cats.length > 0 && (
          <section aria-labelledby="cats">
            <h2 id="cats" className="mb-6 text-2xl font-extrabold sm:text-4xl">Что готовим</h2>
            <ul className="grid grid-cols-4 gap-x-2.5 gap-y-6 sm:gap-x-4 lg:grid-cols-8">
              {cats.map((c) => {
                const item = cover(c.id);
                return (
                  <li key={c.id} className={toneClass(c.slug)}>
                    <Link href={`/menu?category=${c.slug}`} className="group block text-center">
                      {item
                        ? <ProductImage image={item.image} name={c.name} categorySlug={c.slug} className="aspect-[4/5]! shadow-[3px_3px_0_0_#14231a] transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:rotate-2" />
                        : <div className="arch grid aspect-[4/5] place-items-center border-2 border-ink bg-(--tone) text-5xl">{categoryEmoji(c.slug)}</div>}
                      <span className="mt-2.5 block text-xs font-extrabold leading-tight group-hover:underline sm:text-base">{c.name}</span>
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
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 id="top" className="text-2xl font-extrabold sm:text-4xl">{popular.length >= 4 ? "Выбирают чаще всего" : "С чего начать"}</h2>
              <Link href="/menu" className="btn btn-white pop pop-sm !px-4 !py-2 text-sm">Всё меню</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{featured.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div>
          </section>
        )}
      </div>

      {/* Сеты */}
      {setItems.length > 0 && (
        <section className="relative overflow-hidden border-y-2 border-ink bg-pom text-white">
          <span aria-hidden className="float absolute right-[6%] top-6 text-5xl [--r:12deg]">🎁</span>
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:py-16 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-3xl font-black leading-tight sm:text-5xl">Сеты выгоднее, чем по отдельности</h2>
              <p className="mt-4 max-w-md text-lg">Боул и напиток, детокс на весь день или завтрак для двоих. Цена уже со скидкой.</p>
              <Link href="/menu?category=sets" className="btn btn-lime pop mt-6">Выбрать сет</Link>
            </div>
            <ul className="grid grid-cols-3 gap-3 sm:gap-5">
              {setItems.map((p, i) => (
                <li key={p.id} className={i === 1 ? "mt-6" : ""}>
                  <Link href={`/menu/${p.slug}`} className="group block">
                    <ProductImage image={p.image} name={p.name} categorySlug="sets" className={`shadow-[4px_4px_0_0_#14231a] transition-transform duration-200 group-hover:-translate-y-1.5 ${i === 0 ? "-rotate-3" : i === 2 ? "rotate-3" : ""}`} />
                    <p className="display mt-2 text-[11px] font-bold leading-tight sm:text-sm">{p.name}</p>
                    <p className="text-xs font-semibold text-lime sm:text-sm">{sum(p.defaultPrice)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Как заказать */}
      <section aria-labelledby="how" className="border-b-2 border-ink bg-berry text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 id="how" className="text-2xl font-extrabold sm:text-4xl">Как заказать</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="display grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-lime text-xl font-black text-ink shadow-[3px_3px_0_0_#14231a]">{i + 1}</span>
                <div><p className="text-lg font-extrabold">{t}</p><p className="mt-1 leading-relaxed text-white/85">{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {locations.length > 0 && (
        <section aria-labelledby="where" className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <h2 id="where" className="mb-6 text-2xl font-extrabold sm:text-4xl">Наши точки</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((l, i) => (
              <li key={l.id} className={`pop rounded-3xl p-5 ${current?.id === l.id ? "bg-mango" : "bg-white"} ${i % 2 ? "sm:rotate-1" : "sm:-rotate-1"}`}>
                <p className="display text-lg font-extrabold">📍 {l.name}</p>
                {l.address && <p className="mt-1 text-sm font-medium">{l.address}</p>}
                {current?.id === l.id && <p className="mt-2 text-sm font-bold">Заказ оформляется на эту точку</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
