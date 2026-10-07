import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteLocation } from "@/lib/site";
import { getProductBySlug, suggestions } from "@/services/catalog";
import { toneClass } from "@/lib/tone";
import { ProductImage } from "@/components/site/ProductImage";
import { ProductCard } from "@/components/site/ProductCard";
import { Configurator } from "@/components/site/Configurator";

export const dynamic = "force-dynamic";

const ALLERGEN: Record<string, string> = { milk: "молоко", gluten: "глютен", nuts: "орехи", peanut: "арахис", egg: "яйца", soy: "соя", fish: "рыба", sesame: "кунжут" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { current } = await getSiteLocation();
  const p = await getProductBySlug(slug, current?.id ?? null);
  return p ? { title: p.name, description: p.description ?? undefined } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { current } = await getSiteLocation();
  const p = await getProductBySlug(slug, current?.id ?? null);
  if (!p) notFound();
  const more = await suggestions([p.id], current?.id ?? null, 4);
  const n = [["ккал", p.calories], ["белки, г", p.protein], ["углеводы, г", p.carbs], ["жиры, г", p.fat]] as const;
  const tag = "rounded-full bg-lime-soft px-3 py-1 text-sm font-semibold text-leaf-deep";

  return (
    <div className={`${toneClass(p.category.slug)} space-y-14`}>
      <nav aria-label="Навигация" className="text-sm text-muted">
        <Link href="/menu" className="hover:text-ink">Меню</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/menu?category=${p.category.slug}`} className="hover:text-ink">{p.category.name}</Link>
      </nav>
      <div className="grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12">
        <div className="mx-auto w-full max-w-md md:max-w-none"><ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority className="md:max-h-[34rem]" /></div>
        <div className="space-y-6">
          <div>
            <p className="font-semibold text-(--tone-deep)">{p.category.name}</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">{p.name}</h1>
            {p.description && <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">{p.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {p.isVegan && <span className={tag}>Веган</span>}
            {p.isHighProtein && <span className={tag}>Много белка</span>}
            {p.isSugarFree && <span className={tag}>Без сахара</span>}
            {p.volumeMl && <span className="rounded-full border border-line px-3 py-1 text-sm">{p.volumeMl} мл</span>}
            <span className="rounded-full border border-line px-3 py-1 text-sm">Готовим ~{p.prepMinutes} мин</span>
          </div>
          <Configurator p={p} />
          {n.some(([, v]) => v != null) && (
            <dl className="grid grid-cols-4 divide-x divide-line border-y border-line py-4 text-center">
              {n.map(([l, v]) => <div key={l} className="flex flex-col-reverse px-1"><dt className="text-xs text-muted">{l}</dt><dd className="display text-lg font-bold">{v ?? "—"}</dd></div>)}
            </dl>
          )}
          <p className="text-sm text-muted"><b className="text-ink">Аллергены:</b> {p.allergens.length ? p.allergens.map((a) => ALLERGEN[a] ?? a).join(", ") : "не указаны"}</p>
        </div>
      </div>
      {more.length > 0 && (
        <section aria-labelledby="more">
          <h2 id="more" className="mb-5 text-2xl font-bold">Вам может понравиться</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{more.map((m) => <ProductCard key={m.id} p={m} />)}</div>
        </section>
      )}
    </div>
  );
}
