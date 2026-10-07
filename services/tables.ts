import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertInStock } from "@/services/availability";
import { priceItems, cartSchema } from "@/services/pos";
import { deductInventoryTx } from "@/lib/services/order-fulfillment";
import { billTotal, closeBlockers, tableNote } from "@/lib/table-bill";
import { isTableToken, newTableToken, TABLE_COOKIE_HOURS } from "@/lib/tables";

type Actor = { id: string; role: Role; locationId: string | null };
const r2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- гость ---------- */

export type TableInfo = { id: string; number: number; locationId: string; locationName: string };

/** Стол по токену из QR. Неактивный стол или точка = как будто его нет. */
export async function getTableByToken(token: unknown): Promise<TableInfo | null> {
  if (!isTableToken(token)) return null;
  const t = await prisma.diningTable.findUnique({ where: { token }, include: { location: { select: { name: true, isActive: true } } } });
  if (!t || !t.isActive || !t.location.isActive) return null;
  return { id: t.id, number: t.number, locationId: t.locationId, locationName: t.location.name };
}

/** Открытый счёт стола; если его нет — создаёт. Два одновременных заказа не создадут два счёта (частичный уникальный индекс). */
async function ensureOpenBill(tableId: string, locationId: string) {
  const open = () => prisma.tableBill.findFirst({ where: { tableId, status: "OPEN" } });
  const found = await open();
  if (found) return found;
  try { return await prisma.tableBill.create({ data: { tableId, locationId } }); }
  catch (e) {
    if ((e as { code?: string } | null)?.code !== "P2002") throw e;
    const again = await open();
    if (again) return again;
    throw e;
  }
}

export const tableOrderSchema = z.object({
  items: cartSchema.shape.items,
  name: z.string().trim().max(60, "Слишком длинное имя").optional(),
  note: z.string().trim().max(250, "Комментарий слишком длинный").optional(),
});

export async function createTableOrder(input: unknown, table: TableInfo) {
  const d = tableOrderSchema.parse(input);
  // защита от спама с одного стола: не больше 5 заказов, которые ещё никто не принял
  if ((await prisma.order.count({ where: { tableId: table.id, status: "NEW" } })) >= 5)
    throw new ApiError(400, "С вашего стола уже ждут несколько заказов. Подождите, пока на кухне их примут.");
  const bill = await ensureOpenBill(table.id, table.locationId);
  const order = await prisma.$transaction(async (tx) => {
    // пока идёт заказ, кассир не сможет закрыть этот счёт (он берёт FOR UPDATE)
    const live = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "TableBill" WHERE "id" = ${bill.id} AND "status" = 'OPEN' FOR SHARE`);
    if (live.length === 0) throw new ApiError(409, "Счёт стола только что закрыли. Отправьте заказ ещё раз.");
    const { lines, subtotal } = await priceItems(tx, d.items);
    await assertInStock(tx, table.locationId, d.items);
    return tx.order.create({
      data: {
        locationId: table.locationId, source: "TABLE", fulfillment: "PICKUP", status: "NEW",
        subtotal, discount: 0, deliveryFee: 0, total: subtotal, note: tableNote(d.name, d.note),
        tableId: table.id, billId: bill.id,
        items: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, modifiers: l.modifiers })) },
        // способ оплаты уточнит кассир при закрытии счёта
        payments: { create: { method: "CASH", status: "PENDING", amount: subtotal } },
      },
    });
  }, { timeout: 20000, maxWait: 10000 });
  try { await audit({ action: "TABLE_ORDER_CREATED", entity: "Order", entityId: order.id, newValue: { number: order.number, table: table.number, total: Number(order.total) } }); } catch (e) { console.error("[AUDIT ERROR]", e); }
  return { orderId: order.id, number: order.number };
}

export type GuestBill = Awaited<ReturnType<typeof getGuestBill>>;

/** Счёт стола глазами гостя: заказы, позиции, итог. Без персональных данных. */
export async function getGuestBill(table: TableInfo) {
  const bill = await prisma.tableBill.findFirst({
    where: { tableId: table.id, status: "OPEN" },
    include: { orders: { orderBy: { createdAt: "asc" }, include: { items: { include: { product: { select: { name: true } } } } } } },
  });
  const orders = (bill?.orders ?? []).map((o) => ({
    id: o.id, number: o.number, status: o.status, createdAt: o.createdAt, note: o.note, total: Number(o.total),
    items: o.items.map((i) => ({
      id: i.id, name: i.product.name, quantity: i.quantity, lineTotal: r2(Number(i.unitPrice) * i.quantity),
      options: (Array.isArray(i.modifiers) ? (i.modifiers as unknown as { name?: string }[]) : []).map((m) => m?.name).filter((x): x is string => !!x),
    })),
  }));
  // «Счёт закрыт» показываем только если стол закрыли недавно (в пределах жизни cookie), а не при каждом пустом столе
  const lastPaid = bill ? null : await prisma.tableBill.findFirst({ where: { tableId: table.id, status: "PAID" }, orderBy: { closedAt: "desc" }, select: { closedAt: true } });
  const justClosed = !!lastPaid?.closedAt && Date.now() - lastPaid.closedAt.getTime() < TABLE_COOKIE_HOURS * 3_600_000;
  return { tableNumber: table.number, locationName: table.locationName, open: !!bill, justClosed, requested: !!bill?.billRequestedAt, total: billTotal(orders), orders };
}

/** Гость просит счёт: касса видит отметку у стола. Повторное нажатие ничего не ломает. */
export async function requestBill(table: TableInfo) {
  const bill = await prisma.tableBill.findFirst({ where: { tableId: table.id, status: "OPEN", orders: { some: { status: { not: "CANCELLED" } } } } });
  if (!bill) throw new ApiError(400, "Пока нет заказов, по которым можно выставить счёт.");
  if (!bill.billRequestedAt) await prisma.tableBill.updateMany({ where: { id: bill.id, status: "OPEN" }, data: { billRequestedAt: new Date() } });
}

/* ---------- касса ---------- */

/** Сетка столов точки: свободен или занят, сумма счёта, просит ли гость счёт, что в работе. */
export async function listTablesWithBills(locationId: string) {
  const tables = await prisma.diningTable.findMany({
    where: { locationId, isActive: true }, orderBy: { number: "asc" },
    include: { bills: { where: { status: "OPEN" }, include: { orders: { select: { id: true, number: true, status: true, total: true } } } } },
  });
  return tables.map((t) => {
    const bill = t.bills[0];
    const orders = (bill?.orders ?? []).map((o) => ({ number: o.number, status: o.status as string, total: Number(o.total) }));
    const live = orders.filter((o) => o.status !== "CANCELLED");
    return {
      id: t.id, number: t.number,
      bill: bill && live.length > 0
        ? { id: bill.id, openedAt: bill.openedAt, total: billTotal(orders), orders: live.length, fresh: live.filter((o) => o.status === "NEW").length, inWork: closeBlockers(orders).length, requested: !!bill.billRequestedAt }
        : null,
    };
  });
}

export type StaffBill = NonNullable<Awaited<ReturnType<typeof getStaffTable>>>;

export async function getStaffTable(tableId: string, user: Actor) {
  const t = await prisma.diningTable.findUnique({ where: { id: tableId } });
  if (!t) return null;
  if (user.locationId && user.locationId !== t.locationId) return null;
  const bill = await prisma.tableBill.findFirst({
    where: { tableId, status: "OPEN" },
    include: { orders: { orderBy: { createdAt: "asc" }, include: { items: { include: { product: { select: { name: true } } } } } } },
  });
  const orders = (bill?.orders ?? []).map((o) => ({
    id: o.id, number: o.number, status: o.status as string, createdAt: o.createdAt, note: o.note, total: Number(o.total),
    items: o.items.map((i) => ({
      id: i.id, name: i.product.name, quantity: i.quantity, lineTotal: r2(Number(i.unitPrice) * i.quantity),
      options: (Array.isArray(i.modifiers) ? (i.modifiers as unknown as { name?: string }[]) : []).map((m) => m?.name).filter((x): x is string => !!x),
    })),
  }));
  return {
    table: { id: t.id, number: t.number, locationId: t.locationId },
    bill: bill ? { id: bill.id, openedAt: bill.openedAt, requested: !!bill.billRequestedAt } : null,
    orders, total: billTotal(orders), blockers: closeBlockers(orders),
  };
}

export const closeBillSchema = z.object({ billId: z.string().min(1), method: z.enum(["CASH", "CARD"], { error: "Выберите способ оплаты" }) });

/**
 * Закрыть счёт стола: принять оплату по всем заказам разом, выдать готовое, списать склад, записать в смену кассира.
 * Всё в одной транзакции; пока заказ ещё готовится, счёт не закрывается.
 */
export async function closeBill(input: unknown, user: Actor) {
  const d = closeBillSchema.parse(input);
  const shift = await prisma.shift.findFirst({ where: { userId: user.id, status: "OPEN" } });
  if (!shift) throw new ApiError(400, "Откройте смену на кассе, чтобы принимать оплату");
  const res = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "TableBill" WHERE "id" = ${d.billId} AND "status" = 'OPEN' FOR UPDATE`);
    if (locked.length === 0) throw new ApiError(400, "Счёт уже закрыт, обновите страницу");
    const bill = await tx.tableBill.findUniqueOrThrow({ where: { id: d.billId }, include: { orders: true } });
    if (user.locationId && user.locationId !== bill.locationId) throw new ApiError(403, "Это счёт другой точки");
    if (shift.locationId !== bill.locationId) throw new ApiError(400, "Ваша смена открыта на другой точке");
    const orders = bill.orders.map((o) => ({ id: o.id, number: o.number, status: o.status as string, total: Number(o.total) }));
    const wait = closeBlockers(orders);
    if (wait.length) throw new ApiError(400, `Пока готовятся заказы: ${wait.map((n) => `№${n}`).join(", ")}. Дождитесь кухни или отмените их в админке.`);
    const live = orders.filter((o) => o.status !== "CANCELLED");
    const now = new Date();
    for (const o of live) {
      if (o.status === "READY") await tx.order.updateMany({ where: { id: o.id, status: "READY" }, data: { status: "COMPLETED", completedAt: now } });
      await deductInventoryTx(tx, o.id, user.id); // идемпотентно: если склад уже списан при принятии, ничего не меняется
    }
    await tx.order.updateMany({ where: { billId: bill.id, status: { not: "CANCELLED" } }, data: { shiftId: shift.id, cashierId: user.id } });
    await tx.payment.updateMany({ where: { order: { billId: bill.id, status: { not: "CANCELLED" } }, status: "PENDING" }, data: { method: d.method, status: "PAID" } });
    const total = billTotal(orders);
    await tx.tableBill.update({ where: { id: bill.id }, data: { status: "PAID", closedAt: now, closedById: user.id, shiftId: shift.id, method: live.length ? d.method : null, total } });
    return { total, orders: live.length, tableId: bill.tableId };
  }, { timeout: 30000, maxWait: 10000 });
  try { await audit({ userId: user.id, action: "TABLE_BILL_CLOSED", entity: "TableBill", entityId: d.billId, newValue: { method: d.method, total: res.total, orders: res.orders } }); } catch (e) { console.error("[AUDIT ERROR]", e); }
  return res;
}

/* ---------- админка ---------- */

export async function listTablesAdmin(locationId: string | null) {
  const tables = await prisma.diningTable.findMany({
    where: locationId ? { locationId } : {}, orderBy: [{ locationId: "asc" }, { number: "asc" }],
    include: { location: { select: { name: true } }, bills: { where: { status: "OPEN" }, select: { id: true } } },
  });
  return tables.map((t) => ({ id: t.id, number: t.number, token: t.token, isActive: t.isActive, location: t.location.name, locationId: t.locationId, hasOpenBill: t.bills.length > 0 }));
}

export async function addTable(locationId: string, user: Actor) {
  if (!(await prisma.location.findFirst({ where: { id: locationId, isActive: true } }))) throw new ApiError(404, "Точка не найдена");
  const last = await prisma.diningTable.aggregate({ where: { locationId }, _max: { number: true } });
  const number = (last._max.number ?? 0) + 1;
  if (number > 200) throw new ApiError(400, "Слишком много столов");
  const t = await prisma.diningTable.create({ data: { locationId, number, token: newTableToken() } });
  try { await audit({ userId: user.id, action: "TABLE_CREATED", entity: "DiningTable", entityId: t.id, newValue: { number } }); } catch (e) { console.error("[AUDIT ERROR]", e); }
  return t;
}

export async function setTableActive(id: string, isActive: boolean, user: Actor) {
  const t = await prisma.diningTable.findUnique({ where: { id }, include: { bills: { where: { status: "OPEN" }, select: { id: true } } } });
  if (!t) throw new ApiError(404, "Стол не найден");
  if (!isActive && t.bills.length > 0) throw new ApiError(400, "За этим столом открыт счёт. Сначала закройте его на кассе.");
  await prisma.diningTable.update({ where: { id }, data: { isActive } });
  try { await audit({ userId: user.id, action: "TABLE_UPDATED", entity: "DiningTable", entityId: id, newValue: { number: t.number, isActive } }); } catch (e) { console.error("[AUDIT ERROR]", e); }
}

/** Новый токен: старый QR перестаёт работать. Нужно, если фото QR утекло или наклейку надо сменить. */
export async function resetTableToken(id: string, user: Actor) {
  const t = await prisma.diningTable.findUnique({ where: { id } });
  if (!t) throw new ApiError(404, "Стол не найден");
  await prisma.diningTable.update({ where: { id }, data: { token: newTableToken() } });
  try { await audit({ userId: user.id, action: "TABLE_TOKEN_RESET", entity: "DiningTable", entityId: id, newValue: { number: t.number } }); } catch (e) { console.error("[AUDIT ERROR]", e); }
}
