import { z } from "zod";
import { hash } from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Владелец", ADMIN: "Администратор", MANAGER: "Менеджер", CASHIER: "Кассир",
  BARISTA: "Бариста", WAREHOUSE: "Кладовщик", ACCOUNTANT: "Бухгалтер",
};
const ROLES = Object.keys(ROLE_LABEL) as Role[];
/** Роли без привязки к точке (видят всё). */
const GLOBAL_ROLES: Role[] = ["OWNER", "ACCOUNTANT"];

type Actor = { id: string; role: Role };

/** Кого может создавать/менять актёр: владелец — всех, администратор — всех, кроме владельца и администраторов. */
export const assignableRoles = (actor: Role): Role[] => (actor === "OWNER" ? ROLES : ROLES.filter((r) => r !== "OWNER" && r !== "ADMIN"));
const canManage = (actor: Role, target: Role) => actor === "OWNER" || (target !== "OWNER" && target !== "ADMIN");

const password = z.string().min(8, "Пароль — минимум 8 символов").max(72, "Пароль слишком длинный");
const base = z.object({
  name: z.string().trim().min(2, "Укажите имя сотрудника").max(80),
  email: z.string().trim().toLowerCase().email("Некорректный email").max(120),
  role: z.enum(ROLES as [Role, ...Role[]], { error: "Выберите роль" }),
  locationId: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().nullable()),
});
const createSchema = base.extend({ password });
const updateSchema = base.omit({ email: true });

async function checkLocation(role: Role, locationId: string | null) {
  if (GLOBAL_ROLES.includes(role)) return null;
  if (!locationId) throw new ApiError(400, "Для этой роли выберите точку");
  const l = await prisma.location.findFirst({ where: { id: locationId, isActive: true } });
  if (!l) throw new ApiError(400, "Точка не найдена");
  return l.id;
}

export async function listEmployees() {
  return prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, isActive: true, location: { select: { name: true } } },
  });
}
export const getEmployee = (id: string) => prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, isActive: true, locationId: true } });

export async function createEmployee(actor: Actor, input: unknown) {
  const d = createSchema.parse(input);
  if (!assignableRoles(actor.role).includes(d.role)) throw new ApiError(403, "Недостаточно прав для создания сотрудника с этой ролью");
  const locationId = await checkLocation(d.role, d.locationId);
  if (await prisma.user.findUnique({ where: { email: d.email } })) throw new ApiError(400, "Сотрудник с таким email уже есть");
  const u = await prisma.user.create({ data: { name: d.name, email: d.email, role: d.role, locationId, passwordHash: await hash(d.password, 10) } });
  await audit({ userId: actor.id, action: "EMPLOYEE_CREATED", entity: "User", entityId: u.id, newValue: { name: u.name, email: u.email, role: u.role, locationId } });
  return u.id;
}

async function activeOwners(exceptId?: string) {
  return prisma.user.count({ where: { role: "OWNER", isActive: true, ...(exceptId ? { id: { not: exceptId } } : {}) } });
}

export async function updateEmployee(actor: Actor, id: string, input: unknown) {
  const d = updateSchema.parse(input);
  const old = await prisma.user.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Сотрудник не найден");
  if (!canManage(actor.role, old.role)) throw new ApiError(403, "Недостаточно прав для изменения этого сотрудника");
  if (!assignableRoles(actor.role).includes(d.role)) throw new ApiError(403, "Недостаточно прав для назначения этой роли");
  if (id === actor.id && d.role !== old.role) throw new ApiError(400, "Нельзя изменить собственную роль");
  if (old.role === "OWNER" && d.role !== "OWNER" && old.isActive && (await activeOwners(id)) === 0) throw new ApiError(400, "В системе должен остаться хотя бы один владелец");
  const locationId = await checkLocation(d.role, d.locationId);
  await prisma.user.update({ where: { id }, data: { name: d.name, role: d.role, locationId } });
  await audit({ userId: actor.id, action: "EMPLOYEE_UPDATED", entity: "User", entityId: id, oldValue: { name: old.name, role: old.role, locationId: old.locationId }, newValue: { name: d.name, role: d.role, locationId } });
}

export async function setEmployeeActive(actor: Actor, id: string, active: boolean) {
  const old = await prisma.user.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Сотрудник не найден");
  if (!canManage(actor.role, old.role)) throw new ApiError(403, "Недостаточно прав для изменения этого сотрудника");
  if (!active && id === actor.id) throw new ApiError(400, "Нельзя отключить самого себя");
  if (!active && old.role === "OWNER" && (await activeOwners(id)) === 0) throw new ApiError(400, "В системе должен остаться хотя бы один владелец");
  if (!active) {
    const shift = await prisma.shift.findFirst({ where: { userId: id, status: "OPEN" } });
    if (shift) throw new ApiError(400, "У сотрудника открыта кассовая смена — сначала её нужно закрыть");
  }
  await prisma.user.update({ where: { id }, data: { isActive: active } });
  await audit({ userId: actor.id, action: active ? "EMPLOYEE_ACTIVATED" : "EMPLOYEE_DEACTIVATED", entity: "User", entityId: id, oldValue: { isActive: old.isActive }, newValue: { isActive: active } });
}

export async function resetPassword(actor: Actor, id: string, input: unknown) {
  const pw = password.parse(input);
  const old = await prisma.user.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Сотрудник не найден");
  if (!canManage(actor.role, old.role) && id !== actor.id) throw new ApiError(403, "Недостаточно прав для изменения этого сотрудника");
  await prisma.user.update({ where: { id }, data: { passwordHash: await hash(pw, 10) } });
  await audit({ userId: actor.id, action: "EMPLOYEE_PASSWORD_RESET", entity: "User", entityId: id });
}
