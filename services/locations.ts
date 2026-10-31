import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { parseCoords } from "@/lib/brand";
import { createEmployee, assignableRoles } from "@/services/employees";
import { z } from "zod";

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

export const newLocationSchema = z.object({
  name: z.string().trim().min(2, "Название точки: минимум 2 символа").max(60, "Название точки: не длиннее 60 символов"),
  address: z.string().optional(), phone: z.string().optional(), coords: z.string().optional(),
  /** Первая учётка менеджера точки (необязательно): все три поля вместе или ни одного */
  managerName: z.string().trim().optional(), managerEmail: z.string().trim().optional(), managerPassword: z.string().optional(),
});

/** Новая точка (филиал). Склад и продажи заработают после первого прихода товара; по желанию сразу заводится менеджер точки. */
export async function createLocation(input: unknown, user: Actor): Promise<{ id: string; name: string; manager: boolean }> {
  const d = newLocationSchema.parse(input);
  const address = clean(d.address, 200, "Адрес");
  const phone = clean(d.phone, 40, "Телефон");
  if (phone && !/^[+\d][\d\s()\-]{5,}$/.test(phone)) throw new ApiError(400, "Телефон указан неверно, например +998 90 123 45 67");
  const c = parseCoords(d.coords ?? "");
  if (c === undefined) throw new ApiError(400, "Координаты нужно вписать так: 41.103801, 69.043818");
  const dup = await prisma.location.findFirst({ where: { name: { equals: d.name, mode: "insensitive" } }, select: { isActive: true } });
  if (dup) throw new ApiError(400, dup.isActive ? "Точка с таким названием уже есть" : "Точка с таким названием уже есть, но она отключена");

  const mgrFilled = [d.managerName, d.managerEmail, d.managerPassword].filter((v) => (v ?? "").trim() !== "").length;
  if (mgrFilled !== 0 && mgrFilled !== 3) throw new ApiError(400, "Для менеджера нужны имя, email и пароль: заполните все три поля или оставьте пустыми");
  const withManager = mgrFilled === 3;
  if (withManager) {
    if (!assignableRoles(user.role).includes("MANAGER")) throw new ApiError(403, "Недостаточно прав, чтобы создать менеджера");
    const email = d.managerEmail!.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw new ApiError(400, "Сотрудник с таким email уже есть");
  }

  const loc = await prisma.location.create({ data: { name: d.name, address, phone, lat: c?.lat ?? null, lng: c?.lng ?? null } });
  await audit({ userId: user.id, action: "LOCATION_CREATED", entity: "Location", entityId: loc.id, newValue: { name: loc.name, address, phone, lat: c?.lat ?? null, lng: c?.lng ?? null } });
  if (withManager) {
    try { await createEmployee(user, { name: d.managerName, email: d.managerEmail, password: d.managerPassword, role: "MANAGER", locationId: loc.id }); }
    catch (e) {
      // точка уже создана: не теряем её, а подсказываем завести менеджера отдельно
      throw new ApiError(400, `Точка «${loc.name}» создана, но менеджера добавить не удалось: ${e instanceof Error ? e.message : "ошибка"}. Добавьте его в разделе «Сотрудники».`);
    }
  }
  return { id: loc.id, name: loc.name, manager: withManager };
}
