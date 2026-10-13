import { TZ_OFFSET_MS } from "@/lib/time";

/** Правило счастливых часов (чистые данные, без базы). */
export type HappyRule = { id?: string; name?: string; percent: number; days: number[]; startMin: number; endMin: number; categoryId: string | null };

export const DAY_LABEL = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** День недели (1 — понедельник … 7 — воскресенье) и минуты от полуночи по Ташкенту. */
export function tashkentClock(ms: number): { dow: number; min: number } {
  const d = new Date(ms + TZ_OFFSET_MS);
  const js = d.getUTCDay(); // 0 — воскресенье
  return { dow: js === 0 ? 7 : js, min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const parseHhmm = (v: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h <= 24 && mi < 60 && !(h === 24 && mi > 0) ? h * 60 + mi : null;
};

/** Подходящее правило с наибольшей скидкой на данный момент для категории. */
export function activeRule(rules: HappyRule[], categoryId: string, atMs: number): HappyRule | null {
  const { dow, min } = tashkentClock(atMs);
  let best: HappyRule | null = null;
  for (const r of rules) {
    if (!r.days.includes(dow) || min < r.startMin || min >= r.endMin) continue;
    if (r.categoryId && r.categoryId !== categoryId) continue;
    if (!best || r.percent > best.percent) best = r;
  }
  return best;
}

/** Цена со скидкой, целые сумы. */
export const discounted = (price: number, percent: number) => Math.round((price * (100 - percent)) / 100);

/** Цена позиции на момент atMs: скидка действует на базовую цену, опции остаются по полной цене. */
export function priceAt(rules: HappyRule[], categoryId: string, basePrice: number, atMs: number) {
  const r = activeRule(rules, categoryId, atMs);
  return r ? { price: discounted(basePrice, r.percent), percent: r.percent, ruleName: r.name ?? null } : { price: basePrice, percent: 0, ruleName: null };
}
