import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canSwitchLocation } from "@/lib/rbac";
import { tashkentDay } from "@/lib/time";
import { dayEnd, dayStart, daysInMonth, isDay, monthFirst, monthLast } from "@/lib/revenue-calendar";

type Actor = { id: string; role: Role; locationId: string | null };
const blank = (v: unknown) => (v === "" || v == null ? undefined : v);
const MAX_DAYS_BACK = 1100;

export type MonthDay = { orders: number; system: number; manual: number };

/** Выручка по дням месяца: завершённые заказы системы и то, что внесено вручную. */
export async function getMonth(ym: string, locationId: string | null) {
  const loc = locationId ? { locationId } : {};
  const first = monthFirst(ym), last = monthLast(ym);
  const [orders, manual] = await Promise.all([
    prisma.order.findMany({ where: { ...loc, status: "COMPLETED", createdAt: { gte: dayStart(first), lt: dayEnd(last) } }, select: { createdAt: true, total: true } }),
    prisma.dailySales.findMany({ where: { ...loc, day: { gte: first, lte: last } }, select: { day: true, amount: true } }),
  ]);
  const days = new Map<string, MonthDay>();
  for (let i = 1; i <= daysInMonth(ym); i++) days.set(`${ym}-${String(i).padStart(2, "0")}`, { orders: 0, system: 0, manual: 0 });
  for (const o of orders) { const d = days.get(tashkentDay(o.createdAt)); if (d) { d.orders++; d.system += Number(o.total); } }
  for (const m of manual) { const d = days.get(m.day); if (d) d.manual += Number(m.amount); }
  const all = [...days.values()];
  const system = all.reduce((a, d) => a + d.system, 0), man = all.reduce((a, d) => a + d.manual, 0);
  return { days, system, manual: man, total: system + man, orders: all.reduce((a, d) => a + d.orders, 0), activeDays: all.filter((d) => d.system + d.manual > 0).length };
}

export type DayDetail = Awaited<ReturnType<typeof getDay>>;

/** Один день: что продано по системе (заказы, способы оплаты, точки) и что внесено вручную. */
export async function getDay(day: string, locationId: string | null) {
  if (!isDay(day)) throw new ApiError(400, "Некорректная дата");
  const loc = locationId ? { locationId } : {};
  const range = { gte: dayStart(day), lt: dayEnd(day) };
  const [orders, payments, entries, locations] = await Promise.all([
    prisma.order.findMany({ where: { ...loc, status: "COMPLETED", createdAt: range }, select: { locationId: true, total: true, source: true } }),
    prisma.payment.findMany({ where: { status: "PAID", order: { ...loc, status: "COMPLETED", createdAt: range } }, select: { method: true, amount: true } }),
    prisma.dailySales.findMany({ where: { ...loc, day }, orderBy: { createdAt: "asc" }, include: { location: { select: { name: true } } } }),
    prisma.location.findMany({ select: { id: true, name: true } }),
  ]);
  const system = orders.reduce((a, o) => a + Number(o.total), 0);
  const byMethod = { CASH: 0, CARD: 0, ONLINE: 0 } as Record<string, number>;
  for (const p of payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
  const names = new Map(locations.map((l) => [l.id, l.name]));
  const per = new Map<string, { name: string; orders: number; system: number; manual: number }>();
  const row = (id: string) => per.get(id) ?? per.set(id, { name: names.get(id) ?? "—", orders: 0, system: 0, manual: 0 }).get(id)!;
  for (const o of orders) { const r = row(o.locationId); r.orders++; r.system += Number(o.total); }
  for (const e of entries) row(e.locationId).manual += Number(e.amount);
  const manual = entries.reduce((a, e) => a + Number(e.amount), 0);
  return {
    day, orders: orders.length, system, manual, total: system + manual, avgCheck: orders.length ? system / orders.length : 0, byMethod,
    entries: entries.map((e) => ({ id: e.id, amount: Number(e.amount), method: e.method as string | null, ordersCount: e.ordersCount, note: e.note, location: e.location.name, locationId: e.locationId })),
    byLocation: [...per.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export const dailySalesSchema = z.object({
  day: z.string().refine(isDay, "Укажите дату"),
  locationId: z.string().min(1, "Выберите точку"),
  amount: z.coerce.number({ error: "Укажите сумму" }).positive("Сумма должна быть больше 0").max(10_000_000_000, "Слишком большая сумма"),
  method: z.preprocess(blank, z.enum(["CASH", "CARD", "ONLINE"]).optional()),
  ordersCount: z.preprocess(blank, z.coerce.number().int("Число чеков: целое число").min(0).max(100000).optional()),
  note: z.preprocess(blank, z.string().trim().max(200, "Слишком длинный комментарий").optional()),
});

function scopeLocation(user: Actor, locationId: string) {
  // привязанные к точке сотрудники пишут и удаляют только в своей точке
  return !canSwitchLocation(user.role) && user.locationId ? user.locationId : locationId;
}

export async function addDailySales(input: unknown, user: Actor) {
  const d = dailySalesSchema.parse(input);
  const today = tashkentDay();
  if (d.day > today) throw new ApiError(400, "Нельзя вносить продажи за будущие дни");
  if (dayStart(d.day).getTime() < Date.now() - MAX_DAYS_BACK * 86400000) throw new ApiError(400, "Слишком старая дата");
  const locationId = scopeLocation(user, d.locationId);
  if (!(await prisma.location.findUnique({ where: { id: locationId } }))) throw new ApiError(404, "Точка не найдена");
  const e = await prisma.dailySales.create({ data: { day: d.day, locationId, amount: d.amount, method: d.method ?? null, ordersCount: d.ordersCount ?? null, note: d.note ?? null, userId: user.id } });
  await audit({ userId: user.id, action: "DAILY_SALES_ADDED", entity: "DailySales", entityId: e.id, newValue: { day: d.day, locationId, amount: d.amount, method: d.method ?? null, ordersCount: d.ordersCount ?? null, note: d.note ?? null } });
  return e.id;
}

export async function deleteDailySales(id: string, user: Actor) {
  const e = await prisma.dailySales.findUnique({ where: { id } });
  if (!e) throw new ApiError(404, "Запись не найдена");
  if (!canSwitchLocation(user.role) && user.locationId && e.locationId !== user.locationId) throw new ApiError(404, "Запись не найдена");
  await prisma.dailySales.delete({ where: { id } });
  await audit({ userId: user.id, action: "DAILY_SALES_DELETED", entity: "DailySales", entityId: id, oldValue: { day: e.day, locationId: e.locationId, amount: Number(e.amount), method: e.method, ordersCount: e.ordersCount, note: e.note } });
  return e.day;
}
