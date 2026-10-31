/** ТВ-меню: какие позиции показывать и как разбить на страницы. Чистая логика без базы. */
export type TvItem = {
  id: string; name: string; description: string | null; image: string | null; categorySlug: string;
  price: number; oldPrice: number | null; happyPct: number;
  volumeMl: number | null; calories: number | null; isVegan: boolean; isHighProtein: boolean; isSugarFree: boolean;
};
export type TvPage = { key: string; category: { id: string; name: string; slug: string }; pageNo: number; pageCount: number; items: TvItem[] };

type Src = {
  id: string; name: string; description: string | null; image: string | null; defaultPrice: number; oldDefaultPrice: number | null; happyPct: number;
  volumeMl: number | null; calories: number | null; isVegan: boolean; isHighProtein: boolean; isSugarFree: boolean;
  available: boolean; comingSoon: boolean; category: { id: string; slug: string };
};

export const TV_PER_PAGE = 6;
export const TV_DEFAULT_SEC = 7;

/** Секунд на одну позицию: из адреса ?sec=, от 3 до 30. */
export function clampSec(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 3 ? Math.min(30, Math.round(n)) : TV_DEFAULT_SEC;
}

/** Страницы по категориям. Показываем только то, что можно заказать сейчас; категории в порядке меню; длинную категорию делим поровну (7 → 4+3, а не 6+1). */
export function buildTvPages(items: Src[], cats: { id: string; name: string; slug: string }[], perPage = TV_PER_PAGE): TvPage[] {
  const pages: TvPage[] = [];
  for (const c of cats) {
    const list: TvItem[] = items
      .filter((p) => p.category.id === c.id && p.available && !p.comingSoon)
      .map((p) => ({ id: p.id, name: p.name, description: p.description, image: p.image, categorySlug: p.category.slug, price: p.defaultPrice, oldPrice: p.oldDefaultPrice, happyPct: p.happyPct, volumeMl: p.volumeMl, calories: p.calories, isVegan: p.isVegan, isHighProtein: p.isHighProtein, isSugarFree: p.isSugarFree }));
    if (list.length === 0) continue;
    const pageCount = Math.ceil(list.length / perPage);
    const base = Math.floor(list.length / pageCount), extra = list.length % pageCount;
    let at = 0;
    for (let i = 0; i < pageCount; i++) {
      const size = base + (i < extra ? 1 : 0);
      pages.push({ key: `${c.id}:${i}`, category: c, pageNo: i + 1, pageCount, items: list.slice(at, at + size) });
      at += size;
    }
  }
  return pages;
}

/** Следующая позиция по кругу: внутри страницы, потом следующая страница, потом с начала. */
export function nextSpot(pages: { items: unknown[] }[], p: number, i: number): [number, number] {
  if (pages.length === 0) return [0, 0];
  if (i + 1 < (pages[p]?.items.length ?? 0)) return [p, i + 1];
  return [(p + 1) % pages.length, 0];
}
