import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { listMenu, listCategories } from "@/services/catalog";
import { ProductCard } from "@/components/site/ProductCard";
import { FilterForm } from "@/components/admin/FilterForm";

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
const pill = (on: boolean) => `whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`;
const diet = (on: boolean) => `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? "bg-lime text-ink ring-2 ring-ink" : "bg-lime-soft text-leaf-deep hover:bg-lime"}`;

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{activeCat ? activeCat.name : "Меню"}</h1>
        {current && <p className="mt-1 text-sm text-muted">Наличие на точке: {current.name}</p>}
      </div>

      <div className="space-y-3">
        <nav aria-label="Категории" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <Link href={href(sp, { category: undefined })} className={pill(!sp.category)}>Все</Link>
          {cats.map((c) => <Link key={c.id} href={href(sp, { category: c.slug })} className={pill(sp.category === c.slug)}>{c.name}</Link>)}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Подобрать:</span>
          {DIETS.map(([k, l]) => <Link key={k} href={href(sp, { diet: sp.diet === k ? undefined : k })} className={diet(sp.diet === k)} aria-pressed={sp.diet === k}>{l}</Link>)}
        </div>
        <FilterForm key={JSON.stringify([sp.q, sp.sort])} className="flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} aria-label="Поиск по меню" placeholder="Поиск по названию и составу" className="min-w-52 flex-1 rounded-full border-2 border-line bg-white px-4 py-2 text-sm" />
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          {sp.diet && <input type="hidden" name="diet" value={sp.diet} />}
          <select name="sort" aria-label="Сортировка" defaultValue={sp.sort ?? "name"} className="rounded-full border-2 border-line bg-white px-4 py-2 text-sm">
            <option value="name">По названию</option><option value="price_asc">Сначала дешевле</option><option value="price_desc">Сначала дороже</option><option value="calories">Меньше калорий</option>
          </select>
          <button className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-leaf">Найти</button>
          {filtered && <Link href="/menu" className="px-2 py-2 text-sm text-muted underline hover:text-ink">Сбросить</Link>}
        </FilterForm>
      </div>

      {items.length === 0
        ? (
          <div className="rounded-3xl border-2 border-dashed border-line p-10 text-center">
            <p className="font-bold">Ничего не нашли</p>
            <p className="mt-1 text-sm text-muted">Уберите часть фильтров или попробуйте другое слово.</p>
            {filtered && <Link href="/menu" className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-leaf">Показать всё меню</Link>}
          </div>
        )
        : <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{items.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div>}
    </div>
  );
}
