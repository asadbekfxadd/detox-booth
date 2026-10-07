import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { parseCoords } from "@/lib/brand";

type Actor = { id: string; role: Role; locationId: string | null };
export type LocationContact = { id: string; name: string; address: string | null; phone: string | null; lat: number | null; lng: number | null };

export const listLocationContacts = (): Promise<LocationContact[]> =>
  prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, address: true, phone: true, lat: true, lng: true } });

const clean = (v: string | undefined, max: number, label: string) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  if (s.length > max) throw new ApiError(400, `«${label}»: не длиннее ${max} символов`);
  return s === "" ? null : s;
};

/** Адрес, телефон и координаты точек: показываются на сайте и на карте. Пустое значение очищает поле. */
export async function saveLocationContacts(input: { id: string; address?: string; phone?: string; coords?: string }[], user: Actor) {
  const current = new Map((await listLocationContacts()).map((l) => [l.id, l]));
  let changed = 0;
  for (const row of input) {
    const old = current.get(row.id);
    if (!old) throw new ApiError(404, "Точка не найдена");
    const address = clean(row.address, 200, "Адрес");
    const phone = clean(row.phone, 40, "Телефон");
    if (phone && !/^[+\d][\d\s()\-]{5,}$/.test(phone)) throw new ApiError(400, `«${old.name}»: телефон указан неверно, например +998 90 123 45 67`);
    const c = parseCoords(row.coords ?? "");
    if (c === undefined) throw new ApiError(400, `«${old.name}»: координаты нужно вписать так: 41.103801, 69.043818`);
    const lat = c?.lat ?? null;
    const lng = c?.lng ?? null;
    if (address === old.address && phone === old.phone && lat === old.lat && lng === old.lng) continue;
    await prisma.location.update({ where: { id: old.id }, data: { address, phone, lat, lng } });
    changed++;
    await audit({ userId: user.id, action: "LOCATION_UPDATED", entity: "Location", entityId: old.id, oldValue: { address: old.address, phone: old.phone, lat: old.lat, lng: old.lng }, newValue: { address, phone, lat, lng } });
  }
  return changed;
}
