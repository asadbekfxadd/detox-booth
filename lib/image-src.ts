/**
 * Фото товаров лежат на Unsplash в размере 900 px. На карточке нужно 300–600 px, поэтому отдаём набор размеров
 * и браузер сам берёт подходящий: на iPad и Mac экономия в 2–4 раза по весу картинок.
 */
const WIDTHS = [360, 540, 720, 900];

export function imageSet(src: string): { src: string; srcSet?: string } {
  let u: URL;
  try { u = new URL(src); } catch { return { src }; }
  if (u.hostname !== "images.unsplash.com") return { src };
  const at = (w: number) => { const x = new URL(u); x.searchParams.set("w", String(w)); x.searchParams.set("q", "70"); return `${x.toString()} ${w}w`; };
  const base = new URL(u); base.searchParams.set("w", "540"); base.searchParams.set("q", "70");
  return { src: base.toString(), srcSet: WIDTHS.map(at).join(", ") };
}

export const SIZES = {
  arch: "(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw",
  wide: "(min-width: 768px) 600px, 100vw",
  thumb: "96px",
} as const;
