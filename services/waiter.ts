import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canSwitchLocation } from "@/lib/rbac";
import { assertInStock } from "@/services/availability";
import { priceItems, type Actor } from "@/services/pos";
import { ensureOpenBill } from "@/services/tables";
import { waiterOrderSchema, waiterNote } from "@/lib/waiter";
import { z } from "zod";

async function safeAudit(a: Parameters<typeof audit>[0]) {
  try { await audit(a); } catch (e) { console.error("[AUDIT ERROR]", e); }
}

/** Стол, доступный сотруднику: активный и в его точке (владелец и менеджер видят все). */
async function scopedTable(tableId: string, user: Actor) {
  const t = await prisma.diningTable.findUnique({ where: { id: tableId }, include: { location: { select: { isActive: true } } } });
  if (!t || !t.isActive || !t.location.isActive) throw new ApiError(404, "Стол не найден");
  if (!canSwitchLocation(user.role) && user.locationId !== t.locationId) throw new ApiError(404, "Стол не найден");
  return t;
}

/** Заказ официанта за столом. Оплата — при закрытии счёта, поэтому источник TABLE. */
export async function createWaiterOrder(input: unknown, user: Actor) {
  const d = waiterOrderSchema.parse(input);
  const table = await scopedTable(d.tableId, user);
  const bill = await ensureOpenBill(table.id, table.locationId);
  const order = await prisma.$transaction(async (tx) => {
    const live = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "TableBill" WHERE "id" = ${bill.id} AND "status" = 'OPEN' FOR SHARE`);
    if (live.length === 0) throw new ApiError(409, "Счёт стола только что закрыли. Отправьте заказ ещё раз.");
    const { lines, subtotal } = await priceItems(tx, d.items);
    await assertInStock(tx, table.locationId, d.items);
    return tx.order.create({
      data: {
        locationId: table.locationId, source: "TABLE", fulfillment: "PICKUP", status: "NEW",
        subtotal, discount: 0, deliveryFee: 0, total: subtotal, note: waiterNote(d.course, d.note),
        tableId: table.id, billId: bill.id, waiterId: user.id, course: d.course, onHold: d.hold,
        items: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, modifiers: l.modifiers })) },
        payments: { create: { method: "CASH", status: "PENDING", amount: subtotal } },
      },
    });
  }, { timeout: 20000, maxWait: 10000 });
  await safeAudit({ action: "WAITER_ORDER_CREATED", entity: "Order", entityId: order.id, newValue: { number: order.number, table: table.number, total: Number(order.total), course: d.course, hold: d.hold } });
  return { orderId: order.id, number: order.number, tableId: table.id };
}

const fireSchema = z.object({ tableId: z.string().min(1), orderId: z.string().min(1).optional(), course: z.number().int().min(1).max(3).optional() });

/** Отправить отложенные заказы стола на кухню: один заказ, целая подача или всё сразу. */
export async function fireHeld(input: unknown, user: Actor) {
  const d = fireSchema.parse(input);
  const table = await scopedTable(d.tableId, user);
  const r = await prisma.order.updateMany({
    where: {
      tableId: table.id, status: "NEW", onHold: true, bill: { status: "OPEN" },
      ...(d.orderId ? { id: d.orderId } : {}), ...(d.course ? { course: d.course } : {}),
    },
    data: { onHold: false, createdAt: new Date() },
  });
  if (r.count === 0) throw new ApiError(400, "Нечего отправлять: заказ уже на кухне или отменён");
  await safeAudit({ action: "WAITER_ORDER_FIRED", entity: "DiningTable", entityId: table.id, newValue: { table: table.number, orders: r.count, course: d.course ?? null } });
  return { count: r.count };
}

/** Отменить заказ, который ещё не ушёл на кухню (после отправки отмену делает менеджер). */
export async function cancelHeldOrder(input: unknown, user: Actor) {
  const d = z.object({ tableId: z.string().min(1), orderId: z.string().min(1) }).parse(input);
  const table = await scopedTable(d.tableId, user);
  const r = await prisma.order.updateMany({
    where: { id: d.orderId, tableId: table.id, status: "NEW", onHold: true, bill: { status: "OPEN" } },
    data: { status: "CANCELLED", onHold: false },
  });
  if (r.count === 0) throw new ApiError(400, "Этот заказ уже на кухне. Отменить его может менеджер.");
  await prisma.payment.updateMany({ where: { orderId: d.orderId, status: "PENDING" }, data: { status: "FAILED" } });
  await safeAudit({ action: "WAITER_HELD_CANCELLED", entity: "Order", entityId: d.orderId, newValue: { table: table.number } });
}

/** Официант просит кассу подготовить счёт. */
export async function requestBillStaff(tableId: string, user: Actor) {
  const table = await scopedTable(tableId, user);
  const bill = await prisma.tableBill.findFirst({ where: { tableId: table.id, status: "OPEN", orders: { some: { status: { not: "CANCELLED" } } } } });
  if (!bill) throw new ApiError(400, "Пока нет заказов, по которым можно выставить счёт.");
  if (!bill.billRequestedAt) await prisma.tableBill.updateMany({ where: { id: bill.id, status: "OPEN" }, data: { billRequestedAt: new Date() } });
}

/**
 * Перенос гостей на другой стол. Если целевой стол свободен — переезжает весь счёт.
 * Если занят — заказы переходят в его счёт (объединение). Оба счёта блокируются в порядке id, чтобы два переноса не зависли друг на друге.
 */
export async function moveTable(input: unknown, user: Actor) {
  const d = z.object({ fromTableId: z.string().min(1), toTableId: z.string().min(1) }).parse(input);
  if (d.fromTableId === d.toTableId) throw new ApiError(400, "Выберите другой стол");
  const [from, to] = await Promise.all([scopedTable(d.fromTableId, user), scopedTable(d.toTableId, user)]);
  if (from.locationId !== to.locationId) throw new ApiError(400, "Столы должны быть в одной точке");

  const merged = await prisma.$transaction(async (tx) => {
    const bills = await tx.tableBill.findMany({ where: { tableId: { in: [from.id, to.id] }, status: "OPEN" }, select: { id: true, tableId: true, billRequestedAt: true }, orderBy: { id: "asc" } });
    if (bills.length > 0) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "TableBill" WHERE "id" IN (${Prisma.join(bills.map((b) => b.id))}) ORDER BY "id" FOR UPDATE`);
    // после блокировки читаем актуальное состояние
    const src = await tx.tableBill.findFirst({ where: { tableId: from.id, status: "OPEN" } });
    if (!src) throw new ApiError(400, "За этим столом нет открытого счёта");
    const dst = await tx.tableBill.findFirst({ where: { tableId: to.id, status: "OPEN" } });
    if (!dst) {
      await tx.tableBill.update({ where: { id: src.id }, data: { tableId: to.id } });
      await tx.order.updateMany({ where: { billId: src.id }, data: { tableId: to.id } });
      return false;
    }
    await tx.order.updateMany({ where: { billId: src.id }, data: { billId: dst.id, tableId: to.id } });
    const data: Prisma.TableBillUpdateInput = {};
    if (src.billRequestedAt && !dst.billRequestedAt) data.billRequestedAt = src.billRequestedAt;
    if (src.openedAt < dst.openedAt) data.openedAt = src.openedAt;
    if (Object.keys(data).length) await tx.tableBill.update({ where: { id: dst.id }, data });
    await tx.tableBill.delete({ where: { id: src.id } });
    return true;
  }, { timeout: 20000, maxWait: 10000 });

  await safeAudit({ action: "TABLE_MOVED", entity: "DiningTable", entityId: from.id, newValue: { from: from.number, to: to.number, merged } });
  return { merged, toTableId: to.id };
}
