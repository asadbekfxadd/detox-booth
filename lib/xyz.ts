/**
 * ABC и XYZ по меню. ABC: вклад в выручку (A — первые 80%, B — следующие 15%, C — остальные 5%).
 * XYZ: насколько ровно продаётся блюдо. Считаем по неделям: коэффициент вариации = разброс ÷ среднее.
 * X — до 10% (продаётся стабильно), Y — 10–25% (колеблется), Z — больше 25% (непредсказуемо).
 */
export type XYZ = "X" | "Y" | "Z";
export const XYZ_LIMITS = { x: 10, y: 25 };
/** Меньше стольких продаж за период: вывод о стабильности ненадёжен */
export const MIN_SALES_FOR_XYZ = 8;

export function weeklyStats(weeks: number[]): { mean: number; cv: number | null } {
  const n = weeks.length;
  if (n === 0) return { mean: 0, cv: null };
  const mean = weeks.reduce((a, b) => a + b, 0) / n;
  if (!(mean > 0)) return { mean: 0, cv: null };
  const variance = weeks.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return { mean, cv: (Math.sqrt(variance) / mean) * 100 };
}

export function xyzClass(cv: number | null): XYZ | null {
  if (cv == null) return null;
  return cv <= XYZ_LIMITS.x ? "X" : cv <= XYZ_LIMITS.y ? "Y" : "Z";
}

/** ABC по убыванию вклада. Ключи с нулевой выручкой получают C. */
export function abcClasses(items: { id: string; value: number }[]): Map<string, "A" | "B" | "C"> {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((a, i) => a + Math.max(0, i.value), 0);
  const out = new Map<string, "A" | "B" | "C">();
  let acc = 0;
  for (const i of sorted) {
    if (!(i.value > 0) || total <= 0) { out.set(i.id, "C"); continue; }
    // класс определяет доля, накопленная ДО этого товара: товар, который перешагнул 80%, ещё входит в A
    const before = (acc / total) * 100;
    out.set(i.id, before < 80 ? "A" : before < 95 ? "B" : "C");
    acc += i.value;
  }
  return out;
}

/** Номер недели (с понедельника) относительно начала окна; вне окна — null */
export function weekIndex(t: number, startMs: number, weeks: number): number | null {
  const i = Math.floor((t - startMs) / (7 * 86400000));
  return i >= 0 && i < weeks ? i : null;
}
