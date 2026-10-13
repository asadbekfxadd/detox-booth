import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { canSwitchLocation } from "@/lib/rbac";
import { getBrand } from "@/services/brand";
import { getServiceFeePct } from "@/services/tables";
import { billReceiptTotals } from "@/lib/receipt";
import { linesFor } from "@/lib/station";
import { courseLabel } from "@/lib/waiter";
import type { Actor } from "@/services/pos";

const num = (d: unknown) => Number(d);
const optionNames = (m: unknown) => (Array.isArray(m) ? (m as { name?: string }[]) : []).map((x) => x?.name).filter((x): x is string => !!x);

function assertScope(user: Actor, locationId: string) {
  if (!canSwitchLocation(user.role) && user.locationId !== locationId) throw new ApiError(404, "Не найдено");
}

type Item = { id: string; name: string; quantity: number; options: string[]; unitPrice: number; lineTotal: number };

const itemInclude = { orderBy: { id: "asc" as const }, include: { product: { select: { name: true, category: { select: { stationId: true, station: { select: { name: true } } } } } } } };

/** Бегунок для кухни: что приготовить. station — id станции, "none" или пусто (все позиции). */
export async function getKitchenTicket(id: string, user: Actor, station: string | null) {
  const o = await prisma.order.findUnique({
    where: { id },
    include: { location: { select: { name: true } }, table: { select: { number: true } }, waiter: { select: { name: true } }, customer: { select: { name: true, phone: true } }, items: itemInclude },
  });
  if (!o) throw new ApiError(404, "Заказ не найден");
  assertScope(user, o.locationId);
  const all = o.items.map((i) => ({ id: i.id, name: i.product.name, quantity: i.quantity, options: optionNames(i.modifiers), stationId: i.product.category.stationId, stationName: i.product.category.station?.name ?? null, readyAt: i.readyAt }));
  const lines = linesFor(all, station);
  if (lines.length === 0) throw new ApiError(404, "В заказе нет позиций этой станции");
  return {
    number: o.number, createdAt: o.createdAt, scheduledFor: o.scheduledFor, source: o.source, fulfillment: o.fulfillment, tableNumber: o.table?.number ?? null,
    waiter: o.waiter?.name ?? null, customer: o.customer?.name.split(" ")[0] ?? null, address: o.fulfillment === "DELIVERY" ? o.address : null, phone: o.fulfillment === "DELIVERY" ? o.customer?.phone ?? null : null, note: o.note, course: o.course, courseLabel: o.course > 1 ? courseLabel(o.course) : null,
    location: o.location.name, stationName: station == null ? null : station === "none" ? "Без станции" : lines[0].stationName, lines,
  };
}

/** Чек одного заказа (касса, сайт). */
export async function getOrderReceipt(id: string, user: Actor) {
  const o = await prisma.order.findUnique({
    where: { id },
    include: { location: { select: { name: true, address: true, phone: true } }, table: { select: { number: true } }, payments: true, cashier: { select: { name: true } }, items: itemInclude },
  });
  if (!o) throw new ApiError(404, "Заказ не найден");
  assertScope(user, o.locationId);
  const brand = await getBrand();
  const items: Item[] = o.items.map((i) => ({ id: i.id, name: i.product.name, quantity: i.quantity, options: optionNames(i.modifiers), unitPrice: num(i.unitPrice), lineTotal: Math.round(num(i.unitPrice) * i.quantity * 100) / 100 }));
  const pay = o.payments.find((p) => p.status === "PAID") ?? o.payments[0];
  return {
    brand: brand.name, location: o.location, number: o.number, createdAt: o.createdAt, cashier: o.cashier?.name ?? null, tableNumber: o.table?.number ?? null,
    items, subtotal: num(o.subtotal), discount: num(o.discount), deliveryFee: num(o.deliveryFee), serviceFee: num(o.serviceFee), total: num(o.total),
    method: pay?.method ?? null, paid: o.payments.some((p) => p.status === "PAID"), tip: o.payments.reduce((s, p) => s + num(p.tip), 0), cancelled: o.status === "CANCELLED",
  };
}

/** Счёт стола: предварительный (пока открыт) или итоговый чек (после оплаты). */
export async function getBillReceipt(billId: string, user: Actor) {
  const b = await prisma.tableBill.findUnique({
    where: { id: billId },
    include: {
      table: { select: { number: true } },
      orders: { orderBy: { createdAt: "asc" }, include: { payments: { select: { status: true, tip: true, method: true } }, items: itemInclude } },
    },
  });
  if (!b) throw new ApiError(404, "Счёт не найден");
  assertScope(user, b.locationId);
  const [brand, feePct, location] = await Promise.all([getBrand(), getServiceFeePct(), prisma.location.findUnique({ where: { id: b.locationId }, select: { name: true, address: true, phone: true } })]);
  const live = b.orders.filter((o) => o.status !== "CANCELLED");
  const items: Item[] = live.flatMap((o) => o.items.map((i) => ({ id: i.id, name: i.product.name, quantity: i.quantity, options: optionNames(i.modifiers), unitPrice: num(i.unitPrice), lineTotal: Math.round(num(i.unitPrice) * i.quantity * 100) / 100 })));
  const totals = billReceiptTotals(live.map((o) => ({ status: o.status, total: num(o.total), serviceFee: num(o.serviceFee), paid: o.payments.some((p) => p.status === "PAID"), tip: o.payments.reduce((s, p) => s + num(p.tip), 0) })), feePct);
  const methods = [...new Set(live.flatMap((o) => o.payments.filter((p) => p.status === "PAID").map((p) => p.method as string)))];
  return { brand: brand.name, location: location ?? { name: "", address: null, phone: null }, tableNumber: b.table.number, openedAt: b.openedAt, closedAt: b.closedAt, isOpen: b.status === "OPEN", feePct, items, ...totals, methods };
}
