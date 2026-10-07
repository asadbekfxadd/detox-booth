import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { listMenu, listCategories } from "@/services/catalog";
import { ProductCard } from "@/components/site/ProductCard";
import { FilterForm } from "@/components/admin/FilterForm";

type SP = Record<string, string | undefined>;
const DIETS = [["vegan", "Веган"], ["protein", "Много белка"], ["sugarfree", "Без сахара"]] as const;

function href(sp: SP, patch: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/menu?${s}` : "/menu";
}
const pill = (on: boolean) => `rounded-full px-4 py-2 text-sm font-medium transition ${on ? "bg-green-700 text-white" : "bg-white text-neutral-700 shadow-sm hover:bg-lime-50"}`;

export default async function MenuPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { current } = await getSiteLocation();
  const [items, cats] = await Promise.all([
    listMenu(current?.id ?? null, { q: sp.q, category: sp.category, diet: sp.diet, sort: sp.sort }),
    listCategories(),
  ]);
  const filtered = !!(sp.q || sp.category || sp.diet);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Меню</h1>
        {current && <p className="text-sm text-neutral-500">Наличие на точке: {current.name}</p>}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link href={href(sp, { category: undefined })} className={pill(!sp.category)}>Все</Link>
          {cats.map((c) => <Link key={c.id} href={href(sp, { category: c.slug })} className={pill(sp.category === c.slug)}>{c.name}</Link>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {DIETS.map(([k, l]) => <Link key={k} href={href(sp, { diet: sp.diet === k ? undefined : k })} className={pill(sp.diet === k)}>{l}</Link>)}
        </div>
        <FilterForm key={JSON.stringify([sp.q, sp.sort])} className="flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Поиск по названию и описанию" className="min-w-60 flex-1 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm" />
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          {sp.diet && <input type="hidden" name="diet" value={sp.diet} />}
          <select name="sort" defaultValue={sp.sort ?? "name"} className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm">
            <option value="name">По названию</option><option value="price_asc">Сначала дешевле</option><option value="price_desc">Сначала дороже</option><option value="calories">Меньше калорий</option>
          </select>
          <button className="rounded-full bg-white px-5 py-2 text-sm font-semibold shadow-sm hover:bg-lime-50">Найти</button>
          {filtered && <Link href="/menu" className="px-2 py-2 text-sm text-neutral-500 underline">Сбросить</Link>}
        </FilterForm>
      </div>

      {items.length === 0
        ? <div className="rounded-3xl bg-white p-10 text-center shadow-sm"><p className="font-bold">Ничего не найдено</p><p className="mt-1 text-sm text-neutral-500">Попробуйте изменить фильтры.</p></div>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
    </div>
  );
}
