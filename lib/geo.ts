/** Геопозиция: расстояние, ближайшая точка, округление и ссылка на карту. Чистая арифметика, без базы. */
export type Coord = { lat: number; lng: number };

export const validCoord = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/** До 3 знаков после запятой: около 100 м. Нам нужен ориентир, а не точный адрес человека. */
export const roundCoord = (n: number) => Math.round(n * 1000) / 1000;

/** Расстояние по прямой, км (формула гаверсинусов) */
export function distanceKm(a: Coord, b: Coord): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ближайшая точка из тех, у которых заданы координаты. Дальше maxKm не предлагаем: человек просто в другом городе. */
export function nearestLocation<T extends { id: string; lat: number | null; lng: number | null }>(list: T[], at: Coord, maxKm = 40): { loc: T; km: number } | null {
  let best: { loc: T; km: number } | null = null;
  for (const l of list) {
    if (l.lat == null || l.lng == null) continue;
    const km = distanceKm(at, { lat: l.lat, lng: l.lng });
    if (!best || km < best.km) best = { loc: l, km };
  }
  return best && best.km <= maxKm ? best : null;
}

export const kmLabel = (km: number) => (km < 1 ? `${Math.max(100, Math.round(km * 10) * 100)} м` : `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} км`);

/** Ссылка на карту по координатам (Яндекс Карты, как на сайте) */
export const coordMapsUrl = (lat: number, lng: number) => `https://yandex.com/maps/?pt=${lng},${lat}&z=17&l=map`;
