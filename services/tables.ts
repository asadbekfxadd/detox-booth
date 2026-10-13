import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertInStock } from "@/services/availability";
import { priceItems, cartSchema } from "@/services/pos";
import { deductInventoryTx } from "@/lib/services/order-fulfillment";
import { billTotal, closeBlockers, tableNote, allocate, feeOf, unpaidOrders, SERVICE_FEE_KEY } from "@/lib/table-bill";
import { isTableToken, newTableToken, TABLE_COOKIE_HOURS } from "@/lib/tables";

type Actor = { id: string; role: Role; locationId: string | null };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Сервисный сбор, % (0 — выключен). Читается в момент оплаты и показа счёта. */
export async function getServiceFeePct(db: Pick<typeof prisma, "setting"> = prisma) {
  const v = (await db.setting.findUnique({ where: { key: SERVICE_FEE_KEY } }))?.value;
  return typeof v === "number" && v > 0 && v <= 100 ? v : 0;
}
const isPaid = (payments: { status: string }[]) => payments.some((p) => p.status === "PAID");

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
export async function ensureOpenBill(tableId: string, locationId: string) {
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
  if ((await prisma.order.count({ where: { tableId: table.id, status: "NEW", onHold: false } })) >= 5)
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
  const [bill, feePct] = await Promise.all([
    prisma.tableBill.findFirst({
      where: { tableId: table.id, status: "OPEN" },
      include: { orders: { orderBy: { createdAt: "asc" }, include: { payments: { select: { status: true } }, items: { include: { product: { select: { name: true } } } } } } },
    }),
    getServiceFeePct(),
  ]);
  const orders = (bill?.orders ?? []).map((o) => ({
    id: o.id, number: o.number, status: o.status, onHold: o.onHold, paid: isPaid(o.payments), createdAt: o.createdAt, note: o.note, total: Number(o.total),
    items: o.items.map((i) => ({
      id: i.id, name: i.product.name, quantity: i.quantity, lineTotal: r2(Number(i.unitPrice) * i.quantity),
      options: (Array.isArray(i.modifiers) ? (i.modifiers as unknown as { name?: string }[]) : []).map((m) => m?.name).filter((x): x is string => !!x),
    })),
  }));
  // «Счёт закрыт» показываем только если стол закрыли недавно (в пределах жизни cookie), а не при каждом пустом столе
  const lastPaid = bill ? null : await prisma.tableBill.findFirst({ where: { tableId: table.id, status: "PAID" }, orderBy: { closedAt: "desc" }, select: { closedAt: true } });
  const justClosed = !!lastPaid?.closedAt && Date.now() - lastPaid.closedAt.getTime() < TABLE_COOKIE_HOURS * 3_600_000;
  const subtotal = billTotal(unpaidOrders(orders));
  const fee = feeOf(subtotal, feePct);
  return {
    tableNumber: table.number, locationName: table.locationName, open: !!bill, justClosed, requested: !!bill?.billRequestedAt,
    /** Заказы без сбора, ещё не оплаченные */
    total: subtotal, feePct, fee, due: r2(subtotal + fee), orders,
  };
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
    include: { bills: { where: { status: "OPEN" }, include: { orders: { select: { id: true, number: true, status: true, total: true, onHold: true, payments: { select: { status: true } } } } } } },
  });
  return tables.map((t) => {
    const bill = t.bills[0];
    const orders = (bill?.orders ?? []).map((o) => ({ number: o.number, status: o.status as string, total: Number(o.total), onHold: o.onHold, paid: isPaid(o.payments) }));
    const live = orders.filter((o) => o.status !== "CANCELLED");
    const open = unpaidOrders(orders);
    return {
      id: t.id, number: t.number,
      bill: bill && live.length > 0
        ? { id: bill.id, openedAt: bill.openedAt, total: billTotal(open), partPaid: open.length < live.length, orders: live.length, fresh: live.filter((o) => o.status === "NEW" && !o.onHold).length, held: live.filter((o) => o.status === "NEW" && o.onHold).length, ready: live.filter((o) => o.status === "READY").length, inWork: closeBlockers(open).length, requested: !!bill.billRequestedAt }
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
    include: { orders: { orderBy: { createdAt: "asc" }, include: { payments: { select: { status: true } }, items: { include: { product: { select: { name: true } } } } } } },
  });
  const feePct = await getServiceFeePct();
  const orders = (bill?.orders ?? []).map((o) => ({
    id: o.id, number: o.number, status: o.status as string, createdAt: o.createdAt, note: o.note, total: Number(o.total),
    course: o.course, onHold: o.onHold, paid: isPaid(o.payments), serviceFee: Number(o.serviceFee),
    items: o.items.map((i) => ({
      id: i.id, name: i.product.name, quantity: i.quantity, lineTotal: r2(Number(i.unitPrice) * i.quantity),
      options: (Array.isArray(i.modifiers) ? (i.modifiers as unknown as { name?: string }[]) : []).map((m) => m?.name).filter((x): x is string => !!x),
    })),
  }));
  return {
    table: { id: t.id, number: t.number, locationId: t.locationId },
    bill: bill ? { id: bill.id, openedAt: bill.openedAt, requested: !!bill.billRequestedAt } : null,
    orders, feePct,
    /** все живые заказы (оплаченные — с уже начисленным сбором) */
    total: billTotal(orders),
    /** ещё не оплачено (без сбора) */
    due: billTotal(unpaidOrders(orders)),
    blockers: closeBlockers(unpaidOrders(orders)),
  };
}

export const closeBillSchema = z.object({
  billId: z.string().min(1),
  method: z.enum(["CASH", "CARD"], { error: "Выберите способ оплаты" }),
  /** Какие заказы оплачивает гость (раздельный счёт). Не указано — все неоплаченные. */
  orderIds: z.array(z.string().min(1)).max(100).optional(),
  tip: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number({ error: "Чаевые — число" }).min(0, "Чаевые не могут быть отрицательными").max(1_000_000_000, "Слишком большая сумма чаевых")).default(0),
});

/**
 * Принять оплату по счёту стола: за все заказы сразу или только за выбранные (раздельный счёт).
 * К выбранным заказам добавляется сервисный сбор (он становится частью суммы заказа), чаевые идут отдельно.
 * Заказ выдаётся, склад списывается, оплата записывается в смену кассира. Счёт закрывается, когда оплачен последний заказ.
 * Всё в одной транзакции; пока заказ ещё готовится, его оплатить нельзя.
 */
export async function closeBill(input: unknown, user: Actor) {
  const d = closeBillSchema.parse(input);
  const shift = await prisma.shift.findFirst({ where: { userId: user.id, status: "OPEN" } });
  if (!shift) throw new ApiError(400, "Откройте смену на кассе, чтобы принимать оплату");
  const res = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "TableBill" WHERE "id" = ${d.billId} AND "status" = 'OPEN' FOR UPDATE`);
    if (locked.length === 0) throw new ApiError(400, "Счёт уже закрыт, обновите страницу");
    const bill = await tx.tableBill.findUniqueOrThrow({ where: { id: d.billId }, include: { orders: { include: { payments: { select: { status: true } } } } } });
    if (user.locationId && user.locationId !== bill.locationId) throw new ApiError(403, "Это счёт другой точки");
    if (shift.locationId !== bill.locationId) throw new ApiError(400, "Ваша смена открыта на другой точке");
    const all = bill.orders.map((o) => ({ id: o.id, number: o.number, status: o.status as string, total: Number(o.total), paid: isPaid(o.payments) }));
    const live = all.filter((o) => o.status !== "CANCELLED");
    const now = new Date();

    // счёт без живых заказов (всё отменено): просто закрываем
    if (live.length === 0) {
      await tx.tableBill.update({ where: { id: bill.id }, data: { status: "PAID", closedAt: now, closedById: user.id, shiftId: shift.id, method: null, total: 0 } });
      return { total: 0, fee: 0, tip: 0, orders: 0, closed: true, tableId: bill.tableId };
    }

    const open = unpaidOrders(all);
    if (open.length === 0) throw new ApiError(400, "Все заказы уже оплачены, обновите страницу");
    const picked = d.orderIds ? open.filter((o) => d.orderIds!.includes(o.id)) : open;
    if (d.orderIds && picked.length !== new Set(d.orderIds).size) throw new ApiError(400, "Состав счёта изменился, обновите страницу");
    if (picked.length === 0) throw new ApiError(400, "Отметьте заказы, которые оплачивает гость");
    const wait = closeBlockers(picked);
    if (wait.length) throw new ApiError(400, `Пока готовятся заказы: ${wait.map((n) => `№${n}`).join(", ")}. Дождитесь кухни или отмените их в админке.`);

    const feePct = await getServiceFeePct(tx);
    const subtotal = billTotal(picked);
    const fees = allocate(feeOf(subtotal, feePct), picked.map((o) => o.total));
    const tips = allocate(Math.round(d.tip * 100) / 100, picked.map((o) => o.total));
    let paidNow = 0;
    for (const [i, o] of picked.entries()) {
      if (o.status === "READY") await tx.order.updateMany({ where: { id: o.id, status: "READY" }, data: { status: "COMPLETED", completedAt: now } });
      await deductInventoryTx(tx, o.id, user.id); // идемпотентно: если склад уже списан при принятии, ничего не меняется
      const newTotal = r2(o.total + fees[i]);
      paidNow += newTotal;
      await tx.order.update({ where: { id: o.id }, data: { total: newTotal, serviceFee: fees[i], shiftId: shift.id, cashierId: user.id } });
      const paid = await tx.payment.updateMany({ where: { orderId: o.id, status: "PENDING" }, data: { method: d.method, status: "PAID", amount: newTotal, tip: tips[i] } });
      if (paid.count === 0) await tx.payment.create({ data: { orderId: o.id, method: d.method, status: "PAID", amount: newTotal, tip: tips[i] } });
    }
    const closed = picked.length === open.length;
    if (closed) {
      const billSum = r2(live.reduce((s, o) => { const p = picked.findIndex((x) => x.id === o.id); return s + (p >= 0 ? o.total + fees[p] : o.total); }, 0));
      await tx.tableBill.update({ where: { id: bill.id }, data: { status: "PAID", closedAt: now, closedById: user.id, shiftId: shift.id, method: d.method, total: billSum } });
    }
    return { total: r2(paidNow), fee: r2(fees.reduce((s, x) => s + x, 0)), tip: r2(tips.reduce((s, x) => s + x, 0)), orders: picked.length, closed, tableId: bill.tableId };
  }, { timeout: 30000, maxWait: 10000 });
  try { await audit({ userId: user.id, action: "TABLE_BILL_CLOSED", entity: "TableBill", entityId: d.billId, newValue: { method: d.method, total: res.total, fee: res.fee, tip: res.tip, orders: res.orders, closed: res.closed } }); } catch (e) { console.error("[AUDIT ERROR]", e); }
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
