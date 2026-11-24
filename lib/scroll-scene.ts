/** Логика прокрутки главной «Кино»: чистые функции без DOM, чтобы проверять их тестами. */

export const clamp = (v: number, min = 0, max = 1): number => (v < min ? min : v > max ? max : v);

export const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export type Track = { progress: number; finale: number };

/**
 * Прогресс по положению секции в окне.
 * scrolled: сколько секции прокручено (−rect.top), total: её высота, stage: высота сцены,
 * finaleLen: длина финала в пикселях (на телефоне 0). Фото листаются на отрезке total − stage − finaleLen,
 * потом последнее держится, а сцена уходит вверх (finale 0…1).
 */
export function trackProgress(scrolled: number, total: number, stage: number, finaleLen: number): Track {
  const a = Math.max(1, total - stage - finaleLen);
  return { progress: clamp(scrolled / a), finale: finaleLen > 0 ? clamp((scrolled - a) / finaleLen) : 0 };
}

/** Вес фото i из n при прогрессе 0…1: между соседними фото плавное перекрытие, сумма весов всегда 1. */
export function photoWeight(progress: number, i: number, n: number): number {
  if (n <= 1) return 1;
  return clamp(1 - Math.abs(clamp(progress) * (n - 1) - i));
}

/** Прозрачность подписи по расстоянию блока от верха окна (в долях высоты сцены): стоит ровно, значит 1, уехал, значит 0. */
export const textOpacity = (distance: number): number => 1 - smooth(0.22, 0.62, Math.abs(distance));

/** Какой из блоков сейчас главный: тот, чей верх ближе всего к верху окна. */
export function nearestIndex(tops: number[]): number {
  let best = 0;
  tops.forEach((t, i) => { if (Math.abs(t) < Math.abs(tops[best])) best = i; });
  return best;
}
