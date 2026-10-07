import Image from "next/image";
import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { listMenu, listCategories, popularIds } from "@/services/catalog";
import { sum } from "@/lib/format";
import { categoryEmoji } from "@/lib/emoji";
import { toneClass } from "@/lib/tone";
import { ProductCard } from "@/components/site/ProductCard";
import { ProductImage } from "@/components/site/ProductImage";
import { SpinBadge } from "@/components/site/SpinBadge";
import { Lucky } from "@/components/site/Lucky";
import { Icon, IconBadge, type IconName } from "@/components/site/Icon";

export const dynamic = "force-dynamic";

const MOODS = [
  { t: "Бодрость с утра", d: "Смузи на фруктах", href: "/menu?category=smoothies", bg: "bg-sun text-forest-deep" },
  { t: "После тренировки", d: "Много белка", href: "/menu?diet=protein", bg: "bg-forest text-white" },
  { t: "Лёгкое и свежее", d: "Без сахара", href: "/menu?diet=sugarfree", bg: "bg-leaf-soft text-forest" },
  { t: "Сытный обед", d: "Боулы и салаты", href: "/menu?category=bowls", bg: "bg-orange text-forest-deep" },
  { t: "Только растения", d: "Веган-меню", href: "/menu?diet=vegan", bg: "bg-leaf text-white" },
  { t: "Выгодно", d: "Сеты со скидкой", href: "/menu?category=sets", bg: "bg-sand text-forest" },
] as const;

const STEPS = [
  ["Выберите точку и блюда", "В меню видно только то, что сейчас есть на выбранной точке."],
  ["Оформите заказ", "Имя и телефон. Самовывоз или доставка, оплата при получении."],
  ["Заберите готовым", "Страница заказа сама покажет, когда всё собрано."],
] as const;

const FAMILY: [IconName, string][] = [["leaf", "Натуральный состав"], ["shield", "Без консервантов"], ["heart", "Полезно и вкусно"]];
const ENERGY: [IconName, string][] = [["bolt", "Больше энергии"], ["pulse", "Поддержка иммунитета"], ["leaf", "Натуральный состав"], ["run", "Для активной жизни"]];
const PERKS: [IconName, string][] = [["apple", "Свежие фрукты"], ["leaf", "Натуральный вкус"], ["pulse", "Поддержка иммунитета"], ["users", "Для всей семьи"]];

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
      {/* Главный экран: солнечный круг, фото напитков, значки преимуществ */}
      <section className="relative isolate overflow-hidden bg-[radial-gradient(70%_80%_at_85%_30%,#ffe3a8_0%,#fff3d6_45%,var(--color-cream)_80%)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-20">
          <div className="relative">
            <p className="script text-3xl text-orange-deep sm:text-4xl">Вместе вкуснее</p>
            <h1 className="mt-2 text-[clamp(2.3rem,5.6vw,4.6rem)] font-black text-forest">Натуральные фрукты. <span className="text-orange-deep">Настоящий вкус.</span></h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-forest/75">Свежие соки, фруктовые миксы и смузи — для взрослых и детей. Готовим сразу после заказа.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/menu" className="btn btn-primary text-lg">Смотреть меню</Link>
              {cats.some((c) => c.slug === "sets") && <Link href="/menu?category=sets" className="btn btn-ghost">Сеты со скидкой</Link>}
            </div>
            <ul className="mt-10 grid max-w-xl grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              {PERKS.map(([ic, t]) => (
                <li key={t} className="flex flex-col items-start gap-2 sm:items-center sm:text-center">
                  <IconBadge name={ic} className="border-forest/80 text-forest" />
                  <span className="text-xs font-bold uppercase leading-tight tracking-wide text-forest/80">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 aspect-square w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_30%_25%,#ffd25a,#ff9a1a_60%,#ff7a00)] shadow-[0_40px_90px_-30px_#ff8a00]" />
            <SpinBadge className="absolute -top-4 right-0 z-10 h-28 w-28 rounded-full bg-forest text-white shadow-xl sm:-top-8 sm:h-36 sm:w-36 lg:-right-2" />
            {heroItems.length === 3 ? (
              <div className="grid grid-cols-[1.15fr_1fr] gap-3 pt-8 sm:gap-4">
                {heroItems.map((p, i) => (
                  <Link key={p.id} href={`/menu/${p.slug}`} className={`${toneClass(p.category.slug)} arch-rise group relative block ${i === 0 ? "row-span-2 self-start" : ""} ${i === 2 ? "sm:translate-x-3" : ""}`}>
                    <ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority className={`${i === 0 ? "aspect-[3/4]!" : "aspect-square!"} rounded-[1.75rem]! border-4 border-white shadow-[0_24px_50px_-24px_rgba(7,45,23,0.55)] transition-transform duration-300 group-hover:scale-[1.02]`} />
                    <span className="display absolute bottom-3 left-3 right-3 truncate rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold leading-tight text-forest shadow sm:text-xs">
                      {p.name} <span className="text-orange-deep">{sum(p.defaultPrice)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-8">
                {["smoothies", "bowls"].map((s) => <div key={s} className="arch-rise"><ProductImage image={null} name="" categorySlug={s} className="aspect-[3/4]! rounded-[1.75rem]!" /></div>)}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-4 py-16 sm:space-y-28 sm:py-24">
        {/* Выбор по настроению */}
        <section aria-labelledby="mood">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="mood" className="text-3xl font-black sm:text-5xl">Что хочется сегодня?</h2>
            <Lucky slugs={sellable.map((p) => p.slug)} />
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {MOODS.map((m) => (
              <li key={m.t}>
                <Link href={m.href} className={`group flex h-full min-h-36 flex-col justify-between gap-6 rounded-[1.75rem] p-4 transition-transform duration-200 hover:-translate-y-1 sm:p-6 ${m.bg}`}>
                  <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-current transition-transform group-hover:rotate-45"><Icon name="arrow" size={20} /></span>
                  <span><span className="display block text-[17px] font-extrabold leading-tight sm:text-2xl">{m.t}</span><span className="mt-1 block text-sm font-semibold opacity-80">{m.d}</span></span>
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
                    <Link href={`/menu?category=${c.slug}`} className="group relative block overflow-hidden rounded-[1.75rem]">
                      {item
                        ? <ProductImage image={item.image} name={c.name} categorySlug={c.slug} className="aspect-[4/5]! rounded-[1.75rem]! transition-transform duration-500 group-hover:scale-105" />
                        : <div className="grid aspect-[4/5] place-items-center rounded-[1.75rem] bg-(--tone) text-6xl">{categoryEmoji(c.slug)}</div>}
                      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-forest-deep via-forest-deep/60 to-transparent p-4 pt-16 text-white">
                        <span className="display text-base font-extrabold leading-tight sm:text-xl">{c.name}</span>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-(--tone) text-forest-deep transition-transform group-hover:rotate-45"><Icon name="arrow" size={18} /></span>
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
              <Link href="/menu" className="btn btn-ghost !px-4 !py-2 text-sm">Всё меню</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{featured.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div>
          </section>
        )}

        {/* Для всей семьи */}
        <section aria-labelledby="family" className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div className="relative">
            <Image src="/brand/family.jpg" alt="Семья с соками Vitamin B на террасе" width={800} height={560} sizes="(min-width: 1024px) 560px, 100vw" className="aspect-[10/8] w-full rounded-[2rem] object-cover shadow-[0_30px_60px_-30px_rgba(7,45,23,0.5)]" />
            <Image src="/brand/kids.jpg" alt="Дети пьют смузи Vitamin B" width={481} height={387} sizes="220px" className="absolute -bottom-6 -right-2 hidden w-44 rounded-3xl border-4 border-white object-cover shadow-xl sm:block sm:w-52" />
            <p className="script absolute -top-5 left-4 -rotate-3 rounded-2xl bg-forest px-5 py-2 text-2xl text-orange shadow-lg sm:text-3xl">Семейные моменты со вкусом</p>
          </div>
          <div>
            <p className="script text-3xl text-orange-deep">Счастливые дети — здоровое будущее</p>
            <h2 id="family" className="mt-2 text-3xl font-black sm:text-5xl">Полезные привычки начинаются с семьи</h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-forest/75">Натуральные соки и фруктовые смузи, которые дети любят, а взрослые выбирают для себя. Свежие фрукты, ничего лишнего.</p>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-4">
              {FAMILY.map(([ic, t]) => (
                <li key={t} className="flex items-center gap-3"><IconBadge name={ic} className="border-orange text-orange-deep" /><span className="text-xs font-bold uppercase leading-tight tracking-wide">{t}</span></li>
              ))}
            </ul>
            <Link href="/menu?category=smoothies" className="btn btn-forest mt-8">Выбрать смузи</Link>
          </div>
        </section>
      </div>

      {/* Энергия на твои цели: тёмный «спортивный» блок */}
      <section aria-labelledby="energy" className="relative overflow-hidden bg-forest-deep text-white">
        <div aria-hidden className="absolute -right-24 top-0 h-[28rem] w-[28rem] rounded-full bg-orange/30 blur-[100px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="script text-3xl text-orange">Натуральные фрукты. Настоящий вкус.</p>
            <h2 id="energy" className="mt-2 text-4xl font-black sm:text-6xl">Энергия на твои цели</h2>
            <p className="mt-5 max-w-md text-lg text-white/75">Твоё движение вперёд: белковые смузи и свежие соки до и после тренировки.</p>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {ENERGY.map(([ic, t]) => (
                <li key={t} className="flex items-center gap-4"><IconBadge name={ic} className="border-white/80 text-white" /><span className="text-xs font-bold uppercase leading-tight tracking-wide">{t}</span></li>
              ))}
            </ul>
            <Link href="/menu?diet=protein" className="btn btn-primary mt-10 text-lg">Меню с белком</Link>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <Image src="/brand/gym.jpg" alt="Спортсмен с апельсиновым соком Vitamin B" width={295} height={330} sizes="384px" className="aspect-[4/4.4] w-full rounded-[2rem] object-cover shadow-[0_30px_80px_-30px_#ff8a00] ring-1 ring-white/20" />
            <p className="display absolute -bottom-4 -left-3 rounded-full bg-orange px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-forest-deep shadow-lg">Good juice, good mood</p>
          </div>
        </div>
      </section>

      {/* Сеты */}
      {setItems.length > 0 && (
        <section className="bg-[linear-gradient(120deg,#ffb000_0%,#ff8a00_60%,#ff6a00_100%)] text-forest-deep">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-4xl font-black sm:text-6xl">Сеты выгоднее, чем по отдельности</h2>
              <p className="mt-5 max-w-md text-lg font-medium">Боул и напиток, детокс на весь день или завтрак для двоих. Цена уже со скидкой.</p>
              <Link href="/menu?category=sets" className="btn btn-forest mt-8 text-lg">Выбрать сет</Link>
            </div>
            <ul className="grid grid-cols-3 gap-3 sm:gap-5">
              {setItems.map((p, i) => (
                <li key={p.id} className={i === 1 ? "mt-8" : ""}>
                  <Link href={`/menu/${p.slug}`} className="group block">
                    <ProductImage image={p.image} name={p.name} categorySlug="sets" className="rounded-[1.5rem]! border-4 border-white shadow-[0_20px_40px_-20px_rgba(7,45,23,0.6)] transition-transform duration-300 group-hover:-translate-y-2" />
                    <p className="display mt-3 text-[11px] font-extrabold leading-tight sm:text-sm">{p.name}</p>
                    <p className="text-xs font-bold sm:text-sm">{sum(p.defaultPrice)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Как заказать */}
      <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <h2 id="how" className="text-3xl font-black sm:text-5xl">Как заказать</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="display grid h-14 w-14 shrink-0 place-items-center rounded-full bg-linear-to-br from-sun to-orange text-2xl font-black text-forest-deep">{i + 1}</span>
              <div><p className="text-lg font-extrabold">{t}</p><p className="mt-1 leading-relaxed text-forest/70">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {locations.length > 0 && (
        <section aria-labelledby="where" className="mx-auto max-w-6xl px-4 pb-16 sm:pb-24">
          <h2 id="where" className="mb-8 text-3xl font-black sm:text-5xl">Наши точки</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((l) => (
              <li key={l.id} className={`rounded-[1.75rem] border p-6 ${current?.id === l.id ? "border-orange bg-sand" : "border-forest/12 bg-white"}`}>
                <p className="display text-lg font-extrabold">{l.name}</p>
                {l.address && <p className="mt-1 text-sm text-forest/70">{l.address}</p>}
                {current?.id === l.id && <p className="mt-3 text-sm font-bold text-orange-deep">Заказ оформляется на эту точку</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
