import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSiteLocation } from "@/lib/site";
import { usableStock } from "@/services/availability";
import { getMixCatalog } from "@/services/mix";
import { Page } from "@/components/site/Page";
import { MixSite } from "@/components/site/MixSite";

export const dynamic = "force-dynamic";
export const metadata = { title: "Свой микс", description: "Соберите сок или смузи из любых фруктов и овощей. Цена считается сразу." };

export default async function MixPage() {
  const { current } = await getSiteLocation();
  const catalog = current ? await getMixCatalog(prisma, await usableStock(prisma, current.id)) : null;
  return (
    <Page className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-black sm:text-5xl">Свой микс</h1>
        <p className="mt-2 max-w-xl text-forest/70">Выберите размер и любые ингредиенты — яблоко, апельсин, имбирь, что захотите. Цена = цена стакана + доплата за дорогие ингредиенты.</p>
      </div>
      {catalog
        ? <div className="rounded-3xl bg-white p-5 pop sm:p-7"><MixSite catalog={catalog} /></div>
        : (
          <div className="rounded-3xl border border-dashed border-forest/25 p-10 text-center">
            <p className="font-bold">Свой микс сейчас недоступен</p>
            <p className="mt-1 text-sm text-forest/60">На этой точке пока нечего смешивать. Загляните позже или выберите напиток из меню.</p>
            <Link href="/menu" className="btn btn-primary mt-4 text-sm">В меню</Link>
          </div>
        )}
    </Page>
  );
}
