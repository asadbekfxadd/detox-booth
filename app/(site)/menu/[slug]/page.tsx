import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteLocation } from "@/lib/site";
import { getProductBySlug, suggestions } from "@/services/catalog";
import { toneClass } from "@/lib/tone";
import { ProductImage } from "@/components/site/ProductImage";
import { ProductCard } from "@/components/site/ProductCard";
import { Configurator } from "@/components/site/Configurator";
import { Art } from "@/components/site/art";
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
  const tag = "rounded-full bg-lime px-3 py-1 text-sm font-bold";

  return (
    <Page className={`${toneClass(p.category.slug)} space-y-8`}>
      <nav aria-label="Навигация" className="text-sm font-semibold">
        <Link href="/menu" className="hover:underline">Меню</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/menu?category=${p.category.slug}`} className="hover:underline">{p.category.name}</Link>
      </nav>
      <div className="sticker relative isolate overflow-hidden rounded-[2rem] bg-(--tone) p-4 sm:rounded-[2.5rem] sm:p-8 lg:p-10">
        <div className="sunburst absolute inset-0 -z-10" />
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-12">
          <div className="relative mx-auto w-full max-w-sm px-3 pb-4 pt-6">
            <Art name="orange" className="absolute -left-1 top-10 z-10 h-14 w-14 -rotate-12 sm:h-20 sm:w-20" />
            <Art name="leaf" className="absolute -right-1 top-2 z-10 h-12 w-12 rotate-12 sm:h-16 sm:w-16" />
            <Art name="sparkle" className="absolute bottom-12 right-0 z-10 h-9 w-9" />
            <ProductImage image={p.image} name={p.name} categorySlug={p.category.slug} priority tint="soft" className="border-2 border-ink shadow-[6px_6px_0_var(--color-ink)]" />
            {p.calories != null && <span className="sticker display absolute -bottom-1 left-0 z-10 grid h-20 w-20 -rotate-6 place-items-center rounded-full bg-pom text-center text-[11px] font-bold leading-tight text-white"><span><span className="block text-xl">{p.calories}</span>ккал</span></span>}
          </div>
          <div className="sticker space-y-6 rounded-3xl bg-white p-5 shadow-[6px_6px_0_var(--color-ink)] sm:p-7">
            <div>
              <p className="font-bold text-(--tone-deep)">{p.category.name}</p>
              <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">{p.name}</h1>
              {p.description && <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">{p.description}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {p.isVegan && <span className={tag}>Веган</span>}
              {p.isHighProtein && <span className={tag}>Много белка</span>}
              {p.isSugarFree && <span className={tag}>Без сахара</span>}
              {p.volumeMl && <span className="rounded-full border border-ink/25 px-3 py-1 text-sm">{p.volumeMl} мл</span>}
              <span className="rounded-full border border-ink/25 px-3 py-1 text-sm">Готовим ~{p.prepMinutes} мин</span>
            </div>
            <Configurator p={p} />
            {n.some(([, v]) => v != null) && (
              <dl className="grid grid-cols-4 divide-x-2 divide-ink/15 border-y-2 border-ink/15 py-4 text-center">
                {n.map(([l, v]) => <div key={l} className="flex flex-col-reverse px-1"><dt className="text-xs text-muted">{l}</dt><dd className="display text-lg font-bold">{v ?? "—"}</dd></div>)}
              </dl>
            )}
            <p className="text-sm text-muted"><b className="text-ink">Аллергены:</b> {p.allergens.length ? p.allergens.map((a) => ALLERGEN[a] ?? a).join(", ") : "не указаны"}</p>
          </div>
        </div>
      </div>
      {more.length > 0 && (
        <section aria-labelledby="more">
          <h2 id="more" className="mb-5 text-2xl font-bold">Вам может понравиться</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">{more.map((m) => <ProductCard key={m.id} p={m} />)}</div>
        </section>
      )}
    </Page>
  );
}
