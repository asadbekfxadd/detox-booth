import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canSwitchLocation } from "@/lib/rbac";
import { assertInStock } from "@/services/availability";
import { deductInventoryTx, awardPointsTx, restockOrderTx } from "@/lib/services/order-fulfillment";
import { ACTIVE, NEXT } from "@/lib/order-status";

export type Actor = { id: string; role: Role; locationId: string | null };
const PAGE = 25;

async function safeAudit(p: Parameters<typeof audit>[0]) {
  try { await audit(p); } catch (e) { console.error("[AUDIT ERROR]", e); }
}
function assertScope(user: Actor, locationId: string) {
  if (!canSwitchLocation(user.role) && user.locationId !== locationId) throw new ApiError(404, "Заказ не найден");
}
const dayStart = (s: string) => new Date(`${s}T00:00:00+05:00`);

// ───────────── Список ─────────────
export type OrderFilters = { status?: string; source?: string; method?: string; from?: string; to?: string; q?: string; page?: number };

function buildWhere(locationId: string | null, f: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (locationId) where.locationId = locationId;
  if (f.status === "active") where.status = { in: [...ACTIVE] };
  else if (f.status && f.status !== "all") where.status = f.status as never;
  if (f.source === "WEB" || f.source === "POS") where.source = f.source;
  if (f.method === "CASH" || f.method === "CARD" || f.method === "ONLINE") where.payments = { some: { method: f.method } };
  const range: { gte?: Date; lt?: Date } = {};
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) range.gte = dayStart(f.from);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) range.lt = new Date(dayStart(f.to).getTime() + 86400000);
  if (range.gte || range.lt) where.createdAt = range;
  const q = f.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    const or: Prisma.OrderWhereInput[] = [{ customer: { is: { name: { contains: q, mode: "insensitive" } } } }];
    if (/^#?\d{1,9}$/.test(q)) or.push({ number: Number(q.replace("#", "")) });
    if (digits.length >= 4) or.push({ customer: { is: { phone: { contains: digits } } } });
    where.OR = or;
  }
  return where;
}

export async function listOrders(locationId: string | null, f: OrderFilters) {
  const where = buildWhere(locationId, f);
  const page = Math.max(1, f.page ?? 1);
  const [rows, count, done, cancelled, delaySetting] = await Promise.all([
    prisma.order.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      include: { customer: { select: { name: true, phone: true } }, payments: true, items: { include: { product: { select: { name: true } } } } },
    }),
    prisma.order.count({ where }),
    prisma.order.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { total: true }, _count: true }),
    prisma.order.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.setting.findUnique({ where: { key: "orders.delayMinutes" } }),
  ]);
  const delay = ((delaySetting?.value as number | undefined) ?? 30) * 60000;
  const now = Date.now();
  return {
    page, pages: Math.max(1, Math.ceil(count / PAGE)), count,
    stats: { completed: done._count, revenue: Number(done._sum.total ?? 0), cancelled },
    rows: rows.map((o) => ({
      id: o.id, number: o.number, createdAt: o.createdAt, source: o.source, fulfillment: o.fulfillment, status: o.status,
      customer: o.customer ? `${o.customer.name} · ${o.customer.phone}` : null, total: Number(o.total),
      payment: o.payments[0] ? { method: o.payments[0].method, status: o.payments[0].status } : null,
      summary: o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", "),
      delayed: (ACTIVE as readonly string[]).includes(o.status) && now - o.createdAt.getTime() > delay,
      ageMin: Math.floor((now - o.createdAt.getTime()) / 60000),
    })),
  };
}

/** Доска: активные заказы по колонкам. */
export async function activeBoard(locationId: string | null) {
  const all = await prisma.order.findMany({
    where: { ...(locationId ? { locationId } : {}), status: { in: [...ACTIVE] } }, orderBy: { createdAt: "asc" }, take: 100,
    include: { customer: { select: { name: true, phone: true } }, payments: true, items: { include: { product: { select: { name: true } } } } },
  });
  const delaySetting = await prisma.setting.findUnique({ where: { key: "orders.delayMinutes" } });
  const delay = ((delaySetting?.value as number | undefined) ?? 30) * 60000;
  const now = Date.now();
  return all.map((o) => ({
    id: o.id, number: o.number, createdAt: o.createdAt, source: o.source, fulfillment: o.fulfillment, status: o.status,
    customer: o.customer ? `${o.customer.name} · ${o.customer.phone}` : null, total: Number(o.total),
    payment: o.payments[0] ? { method: o.payments[0].method, status: o.payments[0].status } : null,
    summary: o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", "),
    delayed: now - o.createdAt.getTime() > delay, ageMin: Math.floor((now - o.createdAt.getTime()) / 60000),
  }));
}

// ───────────── Карточка ─────────────
export async function getOrder(id: string, user: Actor) {
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true, cashier: { select: { name: true } }, location: { select: { name: true } }, payments: true,
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!o) return null;
  if (!canSwitchLocation(user.role) && user.locationId !== o.locationId) return null;
  const logs = await prisma.auditLog.findMany({ where: { entity: "Order", entityId: id }, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } });
  return {
    id: o.id, number: o.number, status: o.status, source: o.source, fulfillment: o.fulfillment, location: o.location.name, locationId: o.locationId,
    createdAt: o.createdAt, completedAt: o.completedAt, address: o.address, cashier: o.cashier?.name ?? null,
    customer: o.customer ? { id: o.customer.id, name: o.customer.name, phone: o.customer.phone } : null,
    subtotal: Number(o.subtotal), discount: Number(o.discount), deliveryFee: Number(o.deliveryFee), total: Number(o.total), cogs: Number(o.cogs),
    promoCode: o.promoCode, pointsEarned: o.pointsEarned, pointsSpent: o.pointsSpent, inventoryDeducted: o.inventoryDeducted,
    payments: o.payments.map((p) => ({ id: p.id, method: p.method, status: p.status, amount: Number(p.amount) })),
    items: o.items.map((i) => ({
      id: i.id, name: i.product.name, quantity: i.quantity, unitPrice: Number(i.unitPrice),
      modifiers: ((i.modifiers as unknown as { name: string }[]) ?? []).map((m) => m.name),
    })),
    log: logs.map((l) => ({ id: l.id, at: l.createdAt, action: l.action, by: l.user?.name ?? null, from: (l.oldValue as { status?: string } | null)?.status ?? null, to: (l.newValue as { status?: string; reason?: string } | null)?.status ?? null, reason: (l.newValue as { reason?: string } | null)?.reason ?? null })),
  };
}

// ───────────── Смена статуса ─────────────
export const advanceSchema = z.object({ id: z.string().min(1), to: z.enum(["CONFIRMED", "PREPARING", "READY", "COMPLETED"]) });
const FROM: Record<string, string> = { CONFIRMED: "NEW", PREPARING: "CONFIRMED", READY: "PREPARING", COMPLETED: "READY" };

export async function advanceOrder(input: unknown, user: Actor) {
  const d = advanceSchema.parse(input);
  const { from } = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: d.id }, include: { payments: true, items: true } });
    if (!o) throw new ApiError(404, "Заказ не найден");
    assertScope(user, o.locationId);
    if (NEXT[o.status]?.to !== d.to) throw new ApiError(400, "Статус заказа уже изменился, обновите страницу");

    if (d.to === "CONFIRMED") {
      const pay = o.payments[0];
      if (pay && pay.status === "PENDING" && pay.method === "ONLINE") throw new ApiError(400, "Сначала подтвердите оплату заказа");
      if (!o.inventoryDeducted) {
        const items = o.items.map((i) => ({ productId: i.productId, quantity: i.quantity, optionIds: (Array.isArray(i.modifiers) ? (i.modifiers as unknown as { optionId?: string }[]) : []).map((m) => m?.optionId).filter((x): x is string => typeof x === "string" && x.length > 0) }));
        await assertInStock(tx, o.locationId, items);
      }
    }
    const lock = await tx.order.updateMany({ where: { id: o.id, status: FROM[d.to] as never }, data: { status: d.to, ...(d.to === "COMPLETED" ? { completedAt: new Date() } : {}) } });
    if (lock.count === 0) throw new ApiError(400, "Статус заказа уже изменился, обновите страницу");

    if (d.to === "CONFIRMED") await deductInventoryTx(tx, o.id, user.id);
    if (d.to === "COMPLETED") {
      await tx.payment.updateMany({ where: { orderId: o.id, status: "PENDING", method: { in: ["CASH", "CARD"] } }, data: { status: "PAID" } }); // оплата на месте при получении
      await deductInventoryTx(tx, o.id, user.id); // на случай заказов, не прошедших подтверждение
      await awardPointsTx(tx, o.id);
    }
    return { from: o.status };
  }, { timeout: 20000, maxWait: 10000 });
  await safeAudit({ userId: user.id, action: "ORDER_STATUS_CHANGED", entity: "Order", entityId: d.id, oldValue: { status: from }, newValue: { status: d.to } });
}

export async function confirmPayment(id: string, user: Actor) {
  const n = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id } });
    if (!o) throw new ApiError(404, "Заказ не найден");
    assertScope(user, o.locationId);
    if (o.status === "CANCELLED" || o.status === "COMPLETED") throw new ApiError(400, "Заказ уже закрыт");
    const r = await tx.payment.updateMany({ where: { orderId: id, status: "PENDING" }, data: { status: "PAID" } });
    if (r.count === 0) throw new ApiError(400, "Оплата уже подтверждена");
    return o.number;
  });
  await safeAudit({ userId: user.id, action: "PAYMENT_CONFIRMED", entity: "Order", entityId: id, newValue: { number: n } });
}

export const cancelSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(3, "Укажите причину отмены").max(200, "Слишком длинная причина"),
  restock: z.boolean().default(false),
});

export async function cancelOrder(input: unknown, user: Actor) {
  const d = cancelSchema.parse(input);
  const res = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: d.id } });
    if (!o) throw new ApiError(404, "Заказ не найден");
    assertScope(user, o.locationId);
    const lock = await tx.order.updateMany({ where: { id: o.id, status: { in: [...ACTIVE] } }, data: { status: "CANCELLED" } });
    if (lock.count === 0) throw new ApiError(400, o.status === "COMPLETED" ? "Завершённый заказ отменить нельзя, оформите возврат" : "Заказ уже отменён");
    await tx.payment.updateMany({ where: { orderId: o.id, status: "PAID" }, data: { status: "REFUNDED" } });
    await tx.payment.updateMany({ where: { orderId: o.id, status: "PENDING" }, data: { status: "FAILED" } });
    const restocked = d.restock ? await restockOrderTx(tx, o.id, user.id) : false;
    if (o.promoCode) await tx.promoCode.updateMany({ where: { code: o.promoCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    return { from: o.status, restocked, wasDeducted: o.inventoryDeducted };
  }, { timeout: 20000, maxWait: 10000 });
  await safeAudit({ userId: user.id, action: "ORDER_CANCELLED", entity: "Order", entityId: d.id, oldValue: { status: res.from }, newValue: { status: "CANCELLED", reason: d.reason, restocked: res.restocked } });
  return res;
}
