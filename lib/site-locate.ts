import { kmLabel, nearestLocation, roundCoord, validCoord } from "@/lib/geo";

export const SITE_GEO_MAX_KM = 40;
export type SiteNearest = { id: string; name: string; km: number; label: string };
type Loc = { id: string; name: string; lat: number | null; lng: number | null };

/** Ближайшая точка к посетителю сайта. null — координаты не годятся или рядом (до 40 км) точек нет. Координаты посетителя не сохраняем. */
export function nearestForVisitor(locations: Loc[], lat: unknown, lng: unknown): SiteNearest | null {
  if (!validCoord(lat, lng)) return null;
  const at = { lat: roundCoord(lat), lng: roundCoord(lng as number) };
  const n = nearestLocation(locations, at, SITE_GEO_MAX_KM);
  return n ? { id: n.loc.id, name: n.loc.name, km: n.km, label: kmLabel(n.km) } : null;
}

/** Есть ли смысл предлагать определение: точек больше одной и хотя бы у одной заданы координаты. */
export const canLocateVisitor = (locations: { lat: number | null; lng: number | null }[]) =>
  locations.length > 1 && locations.some((l) => l.lat != null && l.lng != null);
