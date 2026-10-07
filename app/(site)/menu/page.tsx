import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { listMenu, listCategories } from "@/services/catalog";
import { ProductCard } from "@/components/site/ProductCard";
import { FilterForm } from "@/components/admin/FilterForm";
import { toneClass } from "@/lib/tone";
import { Page } from "@/components/site/Page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Меню" };

type SP = Record<string, string | undefined>;
const DIETS = [["vegan", "Веган"], ["protein", "Много белка"], ["sugarfree", "Без сахара"]] as const;

function href(sp: SP, patch: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/menu?${s}` : "/menu";
}
const pill = (on: boolean) => `whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition-colors ${on ? "border-forest bg-forest text-white" : "border-forest/20 text-forest/85 hover:border-forest/60 hover:bg-sand"}`;
const diet = (on: boolean) => `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${on ? "border-orange bg-sand text-forest" : "border-forest/15 text-forest/75 hover:border-forest/50 hover:bg-sand"}`;

export default async function MenuPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { current } = await getSiteLocation();
  const [items, cats] = await Promise.all([
    listMenu(current?.id ?? null, { q: sp.q, category: sp.category, diet: sp.diet, sort: sp.sort }),
    listCategories(),
  ]);
  const filtered = !!(sp.q || sp.category || sp.diet);
  const activeCat = cats.find((c) => c.slug === sp.category);

  return (
    <Page className="space-y-6">
      <div className={`${toneClass(activeCat?.slug ?? "none")} relative isolate overflow-hidden rounded-[2rem] ${activeCat ? "bg-(--tone)" : "bg-linear-to-br from-sun to-orange"} px-6 py-8 text-forest-deep sm:px-10 sm:py-12`}>
        <div className="sunburst absolute inset-0 -z-10" />
        <h1 className="text-4xl font-black leading-none sm:text-7xl">{activeCat ? activeCat.name : "Меню"}</h1>
        {current && <p className="mt-3 text-sm font-bold opacity-75">Наличие на точке: {current.name}</p>}
      </div>

      <div className="space-y-3">
        <nav aria-label="Категории" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <Link href={href(sp, { category: undefined })} className={pill(!sp.category)}>Все</Link>
          {cats.map((c) => <Link key={c.id} href={href(sp, { category: c.slug })} className={pill(sp.category === c.slug)}>{c.name}</Link>)}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-forest/55">Подобрать:</span>
          {DIETS.map(([k, l]) => <Link key={k} href={href(sp, { diet: sp.diet === k ? undefined : k })} className={diet(sp.diet === k)} aria-pressed={sp.diet === k}>{l}</Link>)}
        </div>
        <FilterForm key={JSON.stringify([sp.q, sp.sort])} className="flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} aria-label="Поиск по меню" placeholder="Поиск по названию и составу" className="min-w-52 flex-1 rounded-xl border border-forest/20 bg-white px-4 py-2.5 text-sm text-forest outline-none focus:border-orange" />
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          {sp.diet && <input type="hidden" name="diet" value={sp.diet} />}
          <select name="sort" aria-label="Сортировка" defaultValue={sp.sort ?? "name"} className="rounded-xl border border-forest/20 bg-white px-4 py-2.5 text-sm text-forest">
            <option value="name">По названию</option><option value="price_asc">Сначала дешевле</option><option value="price_desc">Сначала дороже</option><option value="calories">Меньше калорий</option>
          </select>
          <button className="btn btn-primary !px-5 !py-2.5 text-sm">Найти</button>
          {filtered && <Link href="/menu" className="px-2 py-2 text-sm text-forest/60 underline hover:text-orange-deep">Сбросить</Link>}
        </FilterForm>
      </div>

      {items.length === 0
        ? (
          <div className="rounded-3xl border border-dashed border-forest/25 p-10 text-center">
            <p className="font-bold">Ничего не нашли</p>
            <p className="mt-1 text-sm text-forest/60">Уберите часть фильтров или попробуйте другое слово.</p>
            {filtered && <Link href="/menu" className="btn btn-primary mt-4 text-sm">Показать всё меню</Link>}
          </div>
        )
        : <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div>}
    </Page>
  );
}
