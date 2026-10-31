import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { listDrinkRows } from "@/services/drink-photos";
import { DRINK_PHOTOS, drinkPhotoThumb } from "@/lib/drink-photos";
import { DrinkPhotos } from "@/components/admin/DrinkPhotos";

export default async function DrinkPhotosPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("products.edit");
  const { ok } = await searchParams;
  const rows = await listDrinkRows();
  const library = DRINK_PHOTOS.map((p) => ({ key: p.key, label: p.label, thumb: drinkPhotoThumb(p) }));
  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Сочные фото для напитков</h1><p className="text-sm text-neutral-500">Для каждого напитка подобрано фото по названию. Посмотрите, при желании смените фото в списке справа, отметьте нужные и нажмите «Применить». Снимки бесплатные (Unsplash), указывать автора не нужно.</p></div>
        <Link href="/admin/products" className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50">К продуктам</Link>
      </div>
      {ok != null && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{ok === "0" ? "Фото уже такие же, менять нечего" : `Фото обновлены у напитков: ${ok}`}</p>}
      {rows.length === 0
        ? <p className="rounded-2xl bg-white p-6 text-sm text-neutral-500 shadow-sm">Напитки не найдены. Подбор работает для категорий со словами «смузи», «фреш», «сок», «напитки», «детокс», «лимонад», «коктейль».</p>
        : <DrinkPhotos rows={rows} library={library} />}
    </div>
  );
}
