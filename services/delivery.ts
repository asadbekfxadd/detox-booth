import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canSwitchLocation } from "@/lib/rbac";
import { ACTIVE } from "@/lib/order-status";
import { deliveryStage, collectFromCustomer, type ZoneLike } from "@/lib/delivery";
import { advanceOrder } from "@/services/orders";

type Actor = { id: string; role: Role; locationId: string | null };

async function safeAudit(a: Parameters<typeof audit>[0]) {
  try { await audit(a); } catch (e) { console.error("[AUDIT ERROR]", e); }
}

/* ---------------- зоны ---------------- */

const zoneSchema = z.object({
  locationId: z.string().min(1, "Выберите точку"),
  name: z.string().trim().min(2, "Укажите название зоны").max(60, "Слишком длинное название"),
  fee: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number({ error: "Цена доставки — число" }).min(0, "Цена не может быть отрицательной").max(10_000_000, "Слишком большая цена")),
  minOrder: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number({ error: "Минимальный заказ — число" }).min(0).max(100_000_000)),
  freeFrom: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number({ error: "Порог бесплатной доставки — число" }).min(0).max(100_000_000).nullable()),
  sort: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().int().min(0).max(10000)),
  isActive: z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean()),
});

const toLike = (z: { id: string; name: string; fee: unknown; minOrder: unknown; freeFrom: unknown }): ZoneLike =>
  ({ id: z.id, name: z.name, fee: Number(z.fee), minOrder: Number(z.minOrder), freeFrom: z.freeFrom == null ? null : Number(z.freeFrom) });

/** Зоны, из которых клиент выбирает на сайте. */
export async function activeZones(locationId: string): Promise<ZoneLike[]> {
  const rows = await prisma.deliveryZone.findMany({ where: { locationId, isActive: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] });
  return rows.map(toLike);
}

export const listZones = (locationId: string | null) =>
  prisma.deliveryZone.findMany({ where: locationId ? { locationId } : {}, orderBy: [{ locationId: "asc" }, { sort: "asc" }, { name: "asc" }], include: { location: { select: { name: true } }, _count: { select: { orders: true } } } });

async function assertLocation(user: Actor, locationId: string) {
  if (!canSwitchLocation(user.role) && user.locationId && user.locationId !== locationId) throw new ApiError(403, "Это зона другой точки");
  if (!(await prisma.location.findUnique({ where: { id: locationId }, select: { id: true } }))) throw new ApiError(404, "Точка не найдена");
}

export async function createZone(input: unknown, user: Actor) {
  const d = zoneSchema.parse(input);
  await assertLocation(user, d.locationId);
  const z = await prisma.deliveryZone.create({ data: d });
  await safeAudit({ userId: user.id, action: "ZONE_CREATED", entity: "DeliveryZone", entityId: z.id, newValue: { name: z.name, fee: Number(z.fee) } });
}

export async function updateZone(id: string, input: unknown, user: Actor) {
  const d = zoneSchema.parse(input);
  const old = await prisma.deliveryZone.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Зона не найдена");
  await assertLocation(user, old.locationId);
  await prisma.deliveryZone.update({ where: { id }, data: { name: d.name, fee: d.fee, minOrder: d.minOrder, freeFrom: d.freeFrom, sort: d.sort, isActive: d.isActive } });
  await safeAudit({ userId: user.id, action: "ZONE_UPDATED", entity: "DeliveryZone", entityId: id, oldValue: { name: old.name, fee: Number(old.fee), isActive: old.isActive }, newValue: { name: d.name, fee: d.fee, isActive: d.isActive } });
}

export async function deleteZone(id: string, user: Actor) {
  const old = await prisma.deliveryZone.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Зона не найдена");
  await assertLocation(user, old.locationId);
  await prisma.deliveryZone.delete({ where: { id } });
  await safeAudit({ userId: user.id, action: "ZONE_DELETED", entity: "DeliveryZone", entityId: id, oldValue: { name: old.name } });
}

/* ---------------- диспетчер ---------------- */

function scopeWhere(user: Actor, locationId: string | null) {
  if (!canSwitchLocation(user.role) && user.locationId) return { locationId: user.locationId };
  return locationId ? { locationId } : {};
}

const orderInclude = {
  customer: { select: { name: true, phone: true } }, courier: { select: { id: true, name: true } }, payments: true, deliveryZone: { select: { name: true } },
  items: { orderBy: { id: "asc" as const }, include: { product: { select: { name: true } } } },
};

type Row = Awaited<ReturnType<typeof loadOrders>>[number];
const loadOrders = (where: object, take = 80) => prisma.order.findMany({ where, orderBy: { createdAt: "asc" }, take, include: orderInclude });

function shape(o: Row) {
  const total = Number(o.total);
  const pays = o.payments.map((p) => ({ method: p.method as string, status: p.status as string, amount: Number(p.amount) }));
  return {
    id: o.id, number: o.number, status: o.status as string, createdAt: o.createdAt, scheduledFor: o.scheduledFor, address: o.address, note: o.note, total,
    customer: o.customer?.name ?? null, phone: o.customer?.phone ?? null, zone: o.deliveryZone?.name ?? null,
    courierId: o.courierId, courierName: o.courier?.name ?? null, pickedUpAt: o.pickedUpAt,
    stage: deliveryStage({ status: o.status, courierId: o.courierId, pickedUpAt: o.pickedUpAt }),
    summary: o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", "),
    collect: collectFromCustomer(total, pays),
    paidOnline: pays.some((p) => p.status === "PAID"),
  };
}
export type DeliveryRow = ReturnType<typeof shape>;

/** Доска диспетчера: активные доставки, курьеры и их загрузка, доставленные за сегодня. */
export async function dispatchBoard(user: Actor, locationId: string | null) {
  const scope = scopeWhere(user, locationId);
  const [active, done, couriers] = await Promise.all([
    loadOrders({ ...scope, fulfillment: "DELIVERY", status: { in: [...ACTIVE] }, onHold: false }),
    loadOrders({ ...scope, fulfillment: "DELIVERY", status: "COMPLETED", completedAt: { gte: new Date(Date.now() - 24 * 3600_000) } }, 40),
    prisma.user.findMany({ where: { role: "COURIER", isActive: true, ...(("locationId" in scope) ? { locationId: scope.locationId as string } : {}) }, select: { id: true, name: true, locationId: true }, orderBy: { name: "asc" } }),
  ]);
  const rows = active.map(shape);
  const doneRows = done.map(shape);
  const load = new Map<string, { active: number; delivered: number }>();
  for (const c of couriers) load.set(c.id, { active: 0, delivered: 0 });
  for (const r of rows) if (r.courierId && load.has(r.courierId)) load.get(r.courierId)!.active++;
  for (const r of doneRows) if (r.courierId && load.has(r.courierId)) load.get(r.courierId)!.delivered++;
  return { rows, doneRows, couriers: couriers.map((c) => ({ ...c, ...load.get(c.id)! })) };
}

const assignSchema = z.object({ orderId: z.string().min(1), courierId: z.string().min(1).nullable() });

/** Диспетчер назначает курьера (или снимает назначение). После выезда курьера менять нельзя. */
export async function assignCourier(input: unknown, user: Actor) {
  const d = assignSchema.parse(input);
  const o = await prisma.order.findUnique({ where: { id: d.orderId } });
  if (!o || o.fulfillment !== "DELIVERY") throw new ApiError(404, "Заказ на доставку не найден");
  if (!canSwitchLocation(user.role) && user.locationId && user.locationId !== o.locationId) throw new ApiError(404, "Заказ на доставку не найден");
  if (!(ACTIVE as readonly string[]).includes(o.status)) throw new ApiError(400, "Заказ уже закрыт");
  if (o.pickedUpAt) throw new ApiError(400, "Курьер уже выехал с этим заказом");
  if (d.courierId) {
    const c = await prisma.user.findFirst({ where: { id: d.courierId, role: "COURIER", isActive: true, locationId: o.locationId } });
    if (!c) throw new ApiError(400, "Курьер не найден или работает на другой точке");
  }
  const r = await prisma.order.updateMany({ where: { id: o.id, pickedUpAt: null, status: { in: [...ACTIVE] } }, data: { courierId: d.courierId, courierAssignedAt: d.courierId ? new Date() : null } });
  if (r.count === 0) throw new ApiError(400, "Статус заказа изменился, обновите страницу");
  await safeAudit({ userId: user.id, action: d.courierId ? "DELIVERY_ASSIGNED" : "DELIVERY_UNASSIGNED", entity: "Order", entityId: o.id, newValue: { number: o.number, courierId: d.courierId } });
}

/** Диспетчер отмечает доставленным (например, если курьер не пользуется экраном). */
export async function markDelivered(orderId: string, user: Actor) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o || o.fulfillment !== "DELIVERY") throw new ApiError(404, "Заказ на доставку не найден");
  if (!canSwitchLocation(user.role) && user.locationId && user.locationId !== o.locationId) throw new ApiError(404, "Заказ на доставку не найден");
  if (o.status !== "READY") throw new ApiError(400, "Заказ ещё не готов, доставлять нечего");
  await prisma.order.updateMany({ where: { id: o.id, pickedUpAt: null }, data: { pickedUpAt: new Date() } });
  await advanceOrder({ id: o.id, to: "COMPLETED" }, user);
  await safeAudit({ userId: user.id, action: "DELIVERY_DELIVERED", entity: "Order", entityId: o.id, newValue: { number: o.number, by: "dispatcher" } });
}

/* ---------------- курьер ---------------- */

/** Экран курьера: мои заказы и свободные заказы его точки. */
export async function courierBoard(user: Actor) {
  const scope = user.locationId ? { locationId: user.locationId } : {};
  const [mine, free] = await Promise.all([
    loadOrders({ ...scope, fulfillment: "DELIVERY", courierId: user.id, status: { in: [...ACTIVE] }, onHold: false }),
    loadOrders({ ...scope, fulfillment: "DELIVERY", courierId: null, status: { in: [...ACTIVE] }, onHold: false }),
  ]);
  const doneToday = await prisma.order.count({ where: { courierId: user.id, status: "COMPLETED", completedAt: { gte: new Date(Date.now() - 24 * 3600_000) } } });
  return { mine: mine.map(shape), free: free.map(shape), doneToday };
}

/** Взять свободный заказ. Два курьера не возьмут один: условие courierId=null в самом запросе. */
export async function claimOrder(orderId: string, user: Actor) {
  const r = await prisma.order.updateMany({
    where: { id: orderId, fulfillment: "DELIVERY", courierId: null, status: { in: [...ACTIVE] }, ...(user.locationId ? { locationId: user.locationId } : {}) },
    data: { courierId: user.id, courierAssignedAt: new Date() },
  });
  if (r.count === 0) throw new ApiError(400, "Этот заказ уже взял другой курьер или он закрыт");
  await safeAudit({ userId: user.id, action: "DELIVERY_CLAIMED", entity: "Order", entityId: orderId });
}

/** Отказаться от заказа, пока он не забран. */
export async function releaseOrder(orderId: string, user: Actor) {
  const r = await prisma.order.updateMany({ where: { id: orderId, courierId: user.id, pickedUpAt: null, status: { in: [...ACTIVE] } }, data: { courierId: null, courierAssignedAt: null } });
  if (r.count === 0) throw new ApiError(400, "Этот заказ уже нельзя отдать");
  await safeAudit({ userId: user.id, action: "DELIVERY_RELEASED", entity: "Order", entityId: orderId });
}

/** Забрал заказ и выехал: только когда заказ готов. */
export async function pickUpOrder(orderId: string, user: Actor) {
  const r = await prisma.order.updateMany({ where: { id: orderId, courierId: user.id, status: "READY", pickedUpAt: null }, data: { pickedUpAt: new Date() } });
  if (r.count === 0) throw new ApiError(400, "Заказ ещё не готов или уже у вас в пути");
  await safeAudit({ userId: user.id, action: "DELIVERY_PICKED_UP", entity: "Order", entityId: orderId });
}

/** Доставил: заказ завершается, наличные и карта при получении отмечаются оплаченными. */
export async function deliverOrder(orderId: string, user: Actor) {
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o || o.courierId !== user.id) throw new ApiError(404, "Заказ не найден");
  if (o.status === "COMPLETED") return;
  if (o.status !== "READY" || !o.pickedUpAt) throw new ApiError(400, "Сначала заберите заказ на точке");
  await advanceOrder({ id: o.id, to: "COMPLETED" }, user);
  await safeAudit({ userId: user.id, action: "DELIVERY_DELIVERED", entity: "Order", entityId: o.id, newValue: { number: o.number, by: "courier" } });
}

/** Есть ли у точки активные курьеры: тогда доставку завершает курьер, а не кухня. */
export async function hasCouriers(locationId: string | null) {
  return (await prisma.user.count({ where: { role: "COURIER", isActive: true, ...(locationId ? { locationId } : {}) } })) > 0;
}
