/** Небольшие цветовые расчёты для оформления сайта под бренд. Цвета везде в формате #rrggbb. */
export const HEX = /^#[0-9a-f]{6}$/i;

const toRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

/** Смесь двух цветов: t = 0 даёт a, t = 1 даёт b. */
export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a), y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контраст по WCAG: от 1 до 21. Для обычного текста нужно не меньше 4.5. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** Затемняем цвет, пока он не станет читаемым на заданном фоне. */
export function darkenUntil(hex: string, bg: string, min: number): string {
  let c = hex;
  for (let i = 0; i < 20 && contrast(c, bg) < min; i++) c = mix(c, "#000000", 0.08);
  return c;
}
