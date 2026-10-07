/** Контакты бренда, общие для всего сайта. */
export const INSTAGRAM_HANDLE = "vitaminb.uz";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export type Place = { address?: string | null; lat?: number | null; lng?: number | null };

const strip = (s: string) => s.replace(/ташкент|tashkent|toshkent/gi, "").replace(/[\s,.\-]/g, "");

/** Есть ли что показать на карте: координаты или точный адрес (не просто город). */
export const hasMap = (p: Place) => (p.lat != null && p.lng != null) || (!!p.address && strip(p.address).length >= 5);

/** «41.103801, 69.043818» (как копируется из карт) → координаты. Пустая строка → null, мусор → undefined. */
export function parseCoords(raw: string): { lat: number; lng: number } | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return undefined;
  const lat = Number(m[1].replace(",", "."));
  const lng = Number(m[2].replace(",", "."));
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : undefined;
}

// Координаты точнее адреса: если они заданы, карта и маршрут строятся по ним. Адрес уходит в карту как есть
// (город и район владелец пишет сам: Янгиюль — это не город Ташкент).
const target = (p: Place) => (p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : (p.address ?? ""));

export const mapEmbedUrl = (p: Place) => `https://www.google.com/maps?q=${encodeURIComponent(target(p))}&hl=ru&z=17&output=embed`;
export const googleRouteUrl = (p: Place) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target(p))}`;
export const yandexMapUrl = (p: Place) =>
  p.lat != null && p.lng != null
    ? `https://yandex.uz/maps/?pt=${p.lng},${p.lat}&z=17&l=map`
    : `https://yandex.uz/maps/?text=${encodeURIComponent(p.address ?? "")}`;
