import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteLocation } from "@/lib/site";
import { getProductBySlug, suggestions } from "@/services/catalog";
import { toneClass } from "@/lib/tone";
import { ProductImage } from "@/components/site/ProductImage";
import { ProductCard } from "@/components/site/ProductCard";
import { Configurator } from "@/components/site/Configurator";
import { Page } from "@/components/site/Page";

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
  const tag = "rounded-full bg-(--tone) px-3.5 py-1 text-sm font-bold text-forest-deep";

  return (
    <Page className={`${toneClass(p.category.slug)} space-y-10`}>
      <nav aria-label="Навигация" className="text-sm font-semibold text-forest/60">
        <Link href="/menu" className="hover:text-orange-deep">Меню</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/menu?category=${p.category.slug}`} className="hover:text-orange-deep">{p.category.name}</Link>
      </nav>
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-forest/12 bg-[radial-gradient(90%_70%_at_20%_10%,color-mix(in_srgb,var(--tone)_45%,transparent),transparent_70%),var(--color-surface)] p-4 sm:p-8 lg:p-10">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12">
          <div className="relative mx-auto w-full max-w-md">
            <ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority className="rounded-3xl! shadow-[0_30px_80px_-30px_var(--tone)] ring-1 ring-forest/20" />
            {p.calories != null && <span className="display absolute -bottom-4 -right-2 z-10 grid h-24 w-24 place-items-center rounded-2xl bg-(--tone) text-center text-[11px] font-bold leading-tight text-forest-deep shadow-xl sm:-right-5"><span><span className="block text-3xl font-black">{p.calories}</span>ккал</span></span>}
          </div>
          <div className="space-y-6">
            <div>
              <p className="font-extrabold uppercase tracking-wider text-orange-deep">{p.category.name}</p>
              <h1 className="mt-2 text-4xl font-black leading-[1.02] sm:text-5xl">{p.name}</h1>
              {p.description && <p className="mt-4 max-w-xl text-lg leading-relaxed text-forest/70">{p.description}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {p.isVegan && <span className={tag}>Веган</span>}
              {p.isHighProtein && <span className={tag}>Много белка</span>}
              {p.isSugarFree && <span className={tag}>Без сахара</span>}
              {p.volumeMl && <span className="rounded-full border border-forest/25 px-3.5 py-1 text-sm text-forest/80">{p.volumeMl} мл</span>}
              <span className="rounded-full border border-forest/25 px-3.5 py-1 text-sm text-forest/80">Готовим ~{p.prepMinutes} мин</span>
            </div>
            <Configurator p={p} />
            {n.some(([, v]) => v != null) && (
              <dl className="grid grid-cols-4 divide-x divide-forest/12 rounded-2xl border border-forest/12 bg-sand/60 py-4 text-center">
                {n.map(([l, v]) => <div key={l} className="flex flex-col-reverse px-1"><dt className="text-xs text-forest/55">{l}</dt><dd className="display text-xl font-extrabold text-forest">{v ?? "—"}</dd></div>)}
              </dl>
            )}
            <p className="text-sm text-forest/60"><b className="text-forest">Аллергены:</b> {p.allergens.length ? p.allergens.map((a) => ALLERGEN[a] ?? a).join(", ") : "не указаны"}</p>
          </div>
        </div>
      </div>
      {more.length > 0 && (
        <section aria-labelledby="more">
          <h2 id="more" className="mb-6 text-3xl font-black">Вам может понравиться</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{more.map((m) => <ProductCard key={m.id} p={m} />)}</div>
        </section>
      )}
    </Page>
  );
}
