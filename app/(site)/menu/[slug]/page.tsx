import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteLocation } from "@/lib/site";
import { getProductBySlug, suggestions } from "@/services/catalog";
import { ProductImage } from "@/components/site/ProductImage";
import { ProductCard } from "@/components/site/ProductCard";
import { Configurator } from "@/components/site/Configurator";

const ALLERGEN: Record<string, string> = { milk: "молоко", gluten: "глютен", nuts: "орехи", peanut: "арахис", egg: "яйца", soy: "соя", fish: "рыба", sesame: "кунжут" };

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { current } = await getSiteLocation();
  const p = await getProductBySlug(slug, current?.id ?? null);
  if (!p) notFound();
  const more = await suggestions([p.id], current?.id ?? null, 4);
  const n = [["Ккал", p.calories], ["Белки, г", p.protein], ["Углеводы, г", p.carbs], ["Жиры, г", p.fat]] as const;

  return (
    <div className="space-y-12">
      <Link href="/menu" className="text-sm text-neutral-500 hover:text-neutral-900">← Назад в меню</Link>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm"><ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} className="h-80 md:h-full md:min-h-96" /></div>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-green-800">{p.category.name}</p>
            <h1 className="text-4xl font-extrabold leading-tight">{p.name}</h1>
            {p.description && <p className="mt-2 text-neutral-600">{p.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {p.isVegan && <span className="rounded-full bg-lime-100 px-3 py-1 text-green-900">Веган</span>}
            {p.isHighProtein && <span className="rounded-full bg-lime-100 px-3 py-1 text-green-900">Много белка</span>}
            {p.isSugarFree && <span className="rounded-full bg-lime-100 px-3 py-1 text-green-900">Без сахара</span>}
            {p.volumeMl && <span className="rounded-full bg-neutral-100 px-3 py-1">{p.volumeMl} мл</span>}
            <span className="rounded-full bg-neutral-100 px-3 py-1">Готовим ~{p.prepMinutes} мин</span>
          </div>
          <Configurator p={p} />
          {n.some(([, v]) => v != null) && (
            <div className="grid grid-cols-4 gap-2 rounded-3xl bg-white p-4 text-center shadow-sm">
              {n.map(([l, v]) => <div key={l}><p className="text-lg font-bold">{v ?? "—"}</p><p className="text-xs text-neutral-500">{l}</p></div>)}
            </div>
          )}
          <p className="text-sm text-neutral-600"><b>Аллергены:</b> {p.allergens.length ? p.allergens.map((a) => ALLERGEN[a] ?? a).join(", ") : "не указаны"}</p>
        </div>
      </div>
      {more.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl font-bold">Вам может понравиться</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{more.map((m) => <ProductCard key={m.id} p={m} />)}</div>
        </section>
      )}
    </div>
  );
}
