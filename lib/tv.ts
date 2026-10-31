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

/** Цвет подсветки экрана под напиток: апельсин оранжевый, гранат красный, детокс зелёный. Названия русские и английские; сочетания идут от более яркого цвета к менее. */
const TONES: [RegExp, string][] = [
  [/свекл|свёкл|гранат|beet|pomegran|вишн|cherry/, "#e0204f"],
  [/клубник|малин|арбуз|strawberr|raspberr|watermelon/, "#ff4264"],
  [/ягод|голубик|черник|ежевик|смородин|berry|blueberr/, "#8a63ff"],
  [/морков|carrot/, "#ff6a13"],
  [/апельсин|мандарин|грейпфрут|orange|tangerin|grapefruit/, "#ff8a00"],
  [/манго|ананас|банан|лимон|маракуй|куркум|mango|pineapple|banana|lemon|passion|turmeric/, "#ffc400"],
  [/зелен|зелён|грин|детокс|шпинат|киви|сельдер|огур|мят|green|detox|spinach|kiwi|celery|cucumber|mint/, "#3fb34f"],
  [/яблок|яблоч|apple/, "#a6d12f"],
  [/кокос|овсян|гранол|арахис|орех|coconut|oat|granola|peanut|nut/, "#f2dcaa"],
];
export const TV_DEFAULT_TONE = "#ffb000";
export function tvTone(name: string): string {
  const n = name.toLowerCase();
  return TONES.find(([re]) => re.test(n))?.[1] ?? TV_DEFAULT_TONE;
}

/** Цвет текста на плашке этого цвета: тёмный на светлом, светлый на тёмном (по яркости). */
export function onTone(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#1b1411";
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.3 ? "#1b1411" : "#ffffff";
}

/** Какие категории показать в шапке: до max штук окном вокруг текущей. */
export function categoryWindow<T>(all: T[], current: number, max = 6): { items: T[]; start: number } {
  if (all.length <= max) return { items: all, start: 0 };
  const start = Math.max(0, Math.min(all.length - max, current - Math.floor(max / 2)));
  return { items: all.slice(start, start + max), start };
}
