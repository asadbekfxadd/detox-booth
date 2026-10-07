import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { categoryEmoji } from "@/lib/emoji";
import { listMenu, listCategories, popularIds } from "@/services/catalog";
import { ProductCard } from "@/components/site/ProductCard";

export default async function HomePage() {
  const { locations, current } = await getSiteLocation();
  const [menu, cats, pop] = await Promise.all([listMenu(current?.id ?? null), listCategories(), popularIds()]);
  const sellable = menu.filter((p) => p.available);
  const featured = (pop ? pop.map((id) => sellable.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p) : sellable).slice(0, 4);

  return (
    <div className="space-y-14">
      <section className="rounded-[2rem] bg-gradient-to-br from-green-800 to-green-600 p-8 text-white sm:p-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-lime-200">Здоровая еда без ожидания</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">Смузи, боулы и детокс — свежее каждый день</h1>
        <p className="mt-4 max-w-xl text-lg text-green-50">Выберите точку, соберите заказ и заберите его готовым. Состав и калорийность указаны для каждой позиции.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/menu" className="rounded-full bg-lime-300 px-6 py-3 font-bold text-green-900 hover:bg-lime-200">Смотреть меню</Link>
          <Link href="/cart" className="rounded-full border border-white/60 px-6 py-3 font-semibold hover:bg-white/10">Корзина</Link>
        </div>
      </section>

      {cats.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Категории</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cats.map((c) => (
              <Link key={c.id} href={`/menu?category=${c.slug}`} className="rounded-3xl bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-4xl">{categoryEmoji(c.slug)}</p>
                <p className="mt-2 font-semibold">{c.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{pop ? "Выбирают чаще всего" : "Наше меню"}</h2>
            <Link href="/menu" className="text-sm font-semibold text-green-800 underline">Всё меню</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {[["1", "Выберите точку и блюда", "Меню показывает то, что действительно есть на выбранной точке."], ["2", "Оформите заказ", "Укажите имя и телефон, выберите самовывоз или доставку."], ["3", "Заберите готовым", "Мы соберём заказ и сообщим, когда он будет готов."]].map(([n, t, d]) => (
          <div key={n} className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="grid h-9 w-9 place-items-center rounded-full bg-lime-100 font-bold text-green-900">{n}</p>
            <p className="mt-3 font-bold">{t}</p><p className="mt-1 text-sm text-neutral-600">{d}</p>
          </div>
        ))}
      </section>

      {locations.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Наши точки</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((l) => (
              <div key={l.id} className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="font-bold">📍 {l.name}</p>
                {l.address && <p className="mt-1 text-sm text-neutral-600">{l.address}</p>}
                {current?.id === l.id && <p className="mt-2 text-xs font-semibold text-green-800">Выбрана для заказа</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
