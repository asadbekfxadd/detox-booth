import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { listMenu, listCategories } from "@/services/catalog";
import { ProductCard } from "@/components/site/ProductCard";
import { FilterForm } from "@/components/admin/FilterForm";
import { PromoBanners } from "@/components/site/PromoBanners";
import { Icon } from "@/components/site/Icon";
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

  const showBanners = !filtered && cats.some((c) => c.slug === "sets");

  return (
    <Page className="space-y-6">
      {showBanners
        ? (
          <>
            <h1 className="sr-only">Меню</h1>
            <PromoBanners />
          </>
        )
        : (
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h1 className="text-3xl font-black sm:text-5xl">{activeCat?.name ?? (sp.q ? `Поиск: «${sp.q}»` : "Меню")}</h1>
            <p className="text-sm font-semibold text-forest/60" role="status">Найдено: {items.length}</p>
          </div>
        )}

      <div className="space-y-4">
        <nav aria-label="Категории" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <Link href={href(sp, { category: undefined })} className={pill(!sp.category)}>Все</Link>
          {cats.map((c) => <Link key={c.id} href={href(sp, { category: c.slug })} className={pill(sp.category === c.slug)}>{c.name}</Link>)}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-forest/55">Подобрать:</span>
            {DIETS.map(([k, l]) => <Link key={k} href={href(sp, { diet: sp.diet === k ? undefined : k })} className={diet(sp.diet === k)} aria-pressed={sp.diet === k}>{l}</Link>)}
            {filtered && <Link href="/menu" className="px-2 text-sm text-forest/60 underline hover:text-orange-deep">Сбросить</Link>}
          </div>
          <FilterForm key={JSON.stringify([sp.q, sp.sort])} className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <input name="q" type="text" inputMode="search" enterKeyHint="search" defaultValue={sp.q} aria-label="Поиск по меню" placeholder="Поиск по меню" className="w-full rounded-full border border-forest/20 bg-white py-2 pl-4 pr-10 text-sm text-forest outline-none transition-[width] focus:border-orange sm:w-52 sm:focus:w-64" />
              <button aria-label="Найти" className="absolute inset-y-0 right-1 grid w-9 place-items-center rounded-full text-forest/70 hover:text-orange-deep"><Icon name="search" size={18} /></button>
            </div>
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            {sp.diet && <input type="hidden" name="diet" value={sp.diet} />}
            <select name="sort" aria-label="Сортировка" defaultValue={sp.sort ?? "name"} className="rounded-full border border-forest/20 bg-white py-2 pl-4 pr-3 text-sm text-forest">
              <option value="name">По названию</option><option value="price_asc">Сначала дешевле</option><option value="price_desc">Сначала дороже</option><option value="calories">Меньше калорий</option>
            </select>
          </FilterForm>
        </div>
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
