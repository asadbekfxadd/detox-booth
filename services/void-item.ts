import { Prisma } from "@prisma/client";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { can, canSwitchLocation } from "@/lib/rbac";
import { hit } from "@/lib/rate-limit";
import { applyVoid, needsManagerApproval, sentToKitchen } from "@/lib/void-item";
import type { Actor } from "@/services/pos";

// bcrypt-хеш случайной строки: выравнивает время ответа, когда менеджера с таким email нет
const DUMMY_HASH = "$2b$10$g9kH3Sdf76bTlaIDCyiice10qCh9d/AB5d3AlyiEt8w8oE4fXxvP.";

export const voidItemSchema = z.object({
  orderItemId: z.string().min(1),
  quantity: z.preprocess((v) => (v === "" || v == null ? 1 : v), z.coerce.number({ error: "Укажите количество" }).int("Количество должно быть целым").min(1, "Укажите количество")),
  reason: z.string().trim().min(3, "Укажите причину отмены").max(200, "Слишком длинная причина"),
  approverEmail: z.string().trim().max(200).optional(),
  approverPassword: z.string().max(200).optional(),
});

/** Менеджер, подтвердивший отмену: проверяем email и пароль, право отмены и точку. */
async function verifyApprover(user: Actor, locationId: string, email?: string, password?: string) {
  if (!email || !password) throw new ApiError(403, "Заказ уже на кухне: нужно подтверждение менеджера (его email и пароль)");
  const lim = hit(`void-approve:${user.id}`, 5, 10 * 60_000);
  if (!lim.ok) throw new ApiError(429, `Слишком много попыток подтверждения. Повторите через ${Math.ceil(lim.retryAfterSec / 60)} мин.`);
  const m = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const ok = await compare(password, m?.passwordHash ?? DUMMY_HASH);
  if (!m || !m.isActive || !ok) throw new ApiError(403, "Неверный email или пароль менеджера");
  if (!can(m.role, "orders.cancel")) throw new ApiError(403, "У этого сотрудника нет права подтверждать отмены");
  if (!canSwitchLocation(m.role) && m.locationId !== locationId) throw new ApiError(403, "Менеджер работает на другой точке");
  return m.id;
}

/**
 * Отменить позицию (или часть порций) в неоплаченном заказе стола.
 * Пока заказ не ушёл на кухню, отменяет любой сотрудник точки. После отправки нужно право отмены или подтверждение менеджера.
 * Продукты, которые уже списаны со склада, не возвращаются: блюдо могли приготовить. Если убрали последнюю позицию, заказ отменяется.
 */
export async function voidOrderItem(input: unknown, user: Actor) {
  const d = voidItemSchema.parse(input);
  const found = await prisma.orderItem.findUnique({ where: { id: d.orderItemId }, include: { order: { select: { id: true, number: true, locationId: true, source: true, status: true, onHold: true } } } });
  if (!found || found.order.source !== "TABLE") throw new ApiError(404, "Позиция не найдена");
  const o0 = found.order;
  if (!canSwitchLocation(user.role) && user.locationId !== o0.locationId) throw new ApiError(404, "Позиция не найдена");

  // согласование проверяем до транзакции: bcrypt медленный и не должен держать блокировки
  let approvedById: string | null = null;
  if (needsManagerApproval(o0, can(user.role, "orders.cancel"))) approvedById = await verifyApprover(user, o0.locationId, d.approverEmail, d.approverPassword);
  else if (sentToKitchen(o0)) approvedById = user.id;

  const res = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${o0.id} FOR UPDATE`);
    const o = await tx.order.findUnique({ where: { id: o0.id }, include: { items: { include: { product: { select: { name: true } } } }, payments: { select: { id: true, status: true } } } });
    if (!o) throw new ApiError(404, "Заказ не найден");
    if (o.status === "CANCELLED") throw new ApiError(400, "Заказ уже отменён");
    if (o.payments.some((p) => p.status === "PAID")) throw new ApiError(400, "Заказ уже оплачен. Для оплаченного оформите возврат на кассе.");
    // состояние могло измениться, пока мы проверяли менеджера: пересчитываем нужность согласования
    const afterKitchen = sentToKitchen(o);
    if (afterKitchen && !approvedById) throw new ApiError(409, "Заказ только что ушёл на кухню. Повторите отмену с подтверждением менеджера.");
    const item = o.items.find((i) => i.id === d.orderItemId);
    const r = applyVoid({ subtotal: Number(o.subtotal), total: Number(o.total), items: o.items.map((i) => ({ id: i.id, quantity: i.quantity, unitPrice: Number(i.unitPrice) })) }, d.orderItemId, d.quantity);
    if (!item || !r.ok) throw new ApiError(400, r.ok ? "Позиции уже нет в заказе, обновите страницу" : r.error);

    if (r.leftQty === 0) await tx.orderItem.delete({ where: { id: item.id } });
    else await tx.orderItem.update({ where: { id: item.id }, data: { quantity: r.leftQty } });
    await tx.voidedItem.create({ data: {
      orderId: o.id, locationId: o.locationId, productId: item.productId, name: item.product.name, quantity: r.removedQty,
      unitPrice: item.unitPrice, reason: d.reason, userId: user.id, approvedById, afterKitchen,
    } });

    if (r.orderEmpty) {
      await tx.order.update({ where: { id: o.id }, data: { status: "CANCELLED", onHold: false, subtotal: 0, total: 0 } });
      await tx.payment.updateMany({ where: { orderId: o.id, status: "PENDING" }, data: { status: "FAILED" } });
    } else {
      await tx.order.update({ where: { id: o.id }, data: { subtotal: r.newSubtotal, total: r.newTotal } });
      await tx.payment.updateMany({ where: { orderId: o.id, status: "PENDING" }, data: { amount: r.newTotal } });
      // убрали последнюю неготовую позицию: остальное уже готово, заказ не должен зависнуть в «Готовится»
      if (o.status === "PREPARING" && (await tx.orderItem.count({ where: { orderId: o.id, readyAt: null } })) === 0)
        await tx.order.updateMany({ where: { id: o.id, status: "PREPARING" }, data: { status: "READY" } });
    }
    return { number: o.number, name: item.product.name, qty: r.removedQty, sum: r.removedSum, cancelled: r.orderEmpty, afterKitchen, deducted: o.inventoryDeducted };
  }, { timeout: 20000, maxWait: 10000 });

  await audit({
    userId: user.id, action: "ORDER_ITEM_VOIDED", entity: "Order", entityId: o0.id,
    newValue: { number: res.number, product: res.name, quantity: res.qty, sum: res.sum, reason: d.reason, approvedBy: approvedById, afterKitchen: res.afterKitchen, orderCancelled: res.cancelled, stockKept: res.deducted },
  });
  return res;
}

/** Журнал отмен позиций за период: для отчёта по сотрудникам. */
export async function listVoidedItems(from: Date, to: Date, locationId: string | null) {
  const rows = await prisma.voidedItem.findMany({
    where: { createdAt: { gte: from, lt: to }, ...(locationId ? { locationId } : {}) },
    orderBy: { createdAt: "desc" }, take: 200,
    include: { order: { select: { number: true } } },
  });
  const ids = [...new Set(rows.flatMap((r) => [r.userId, r.approvedById]).filter((x): x is string => !!x))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id, at: r.createdAt, orderNumber: r.order.number, name: r.name, quantity: r.quantity, sum: Number(r.unitPrice) * r.quantity,
    reason: r.reason, by: names.get(r.userId) ?? "—", approvedBy: r.approvedById && r.approvedById !== r.userId ? names.get(r.approvedById) ?? "—" : null, afterKitchen: r.afterKitchen,
  }));
}
