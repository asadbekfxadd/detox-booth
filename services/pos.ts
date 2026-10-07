import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { can, canSwitchLocation } from "@/lib/rbac";
import { resolveLocation } from "@/services/inventory";
import { assertInStock, usableStock, type CartItem } from "@/services/availability";
import { fulfillOrderTx } from "@/lib/services/order-fulfillment";
import { getLoyaltySettings } from "@/lib/loyalty-settings";
import { createCustomerTx } from "@/lib/services/loyalty";
import { lockStock } from "@/lib/stock-lock";

type Tx = Prisma.TransactionClient;
export type Actor = { id: string; role: Role; locationId: string | null };

const r2 = (n: number) => Math.round(n * 100) / 100;
const required = (v: unknown) => (v === "" || v == null ? undefined : v);

/** Журнал аудита не должен превращать уже проведённую продажу в ошибку. */
async function safeAudit(p: Parameters<typeof audit>[0]) {
  try { await audit(p); } catch (e) { console.error("[AUDIT ERROR]", e); }
}

/** Конфликт записи/взаимоблокировка (P2034): безопасно повторяем всю транзакцию. */
async function retryOnConflict<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      if ((e as { code?: string } | null)?.code === "P2034" && i < tries) { await new Promise((r) => setTimeout(r, 60 * i)); continue; }
      throw e;
    }
  }
}

// ───────────── Типы для клиента ─────────────
export type CatalogOption = { id: string; name: string; priceDelta: number };
export type CatalogModifier = { id: string; name: string; multiple: boolean; required: boolean; options: CatalogOption[] };
export type CatalogProduct = {
  id: string; name: string; price: number; categoryId: string; image: string | null;
  isAvailable: boolean; portions: number | null; modifiers: CatalogModifier[];
};
export type PosCatalog = { categories: { id: string; name: string }[]; products: CatalogProduct[] };
export type CustomerLite = { id: string; name: string; phone: string; points: number };
export type RecentOrder = { id: string; number: number; total: number; status: string; method: string | null; createdAt: string; summary: string; refundable: boolean };
export type OrderResult = { ok: true; orderId: string; number: number; total: number; discount: number; change: number; pointsEarned: number; pointsSpent: number; method: string } | { ok: false; error: string };
export type Quote = { ok: true; subtotal: number; discount: number; total: number; pointsAmount: number; maxRedeemPoints: number } | { ok: false; error: string };

// ───────────── Смена ─────────────
export const getOpenShift = (userId: string) =>
  prisma.shift.findFirst({ where: { userId, status: "OPEN" }, include: { location: { select: { id: true, name: true } } } });

export const openShiftSchema = z.object({
  locationId: z.string().optional(),
  openingCash: z.preprocess(required, z.coerce.number({ error: "Укажите сумму наличных в кассе" }).min(0, "Сумма не может быть отрицательной").max(100_000_000, "Слишком большая сумма")),
});

export async function openShift(input: unknown, user: Actor) {
  const d = openShiftSchema.parse(input);
  const locationId = resolveLocation(user, d.locationId);
  if (await prisma.shift.findFirst({ where: { userId: user.id, status: "OPEN" } })) throw new ApiError(400, "У вас уже есть открытая смена");
  if (!(await prisma.location.findUnique({ where: { id: locationId } }))) throw new ApiError(404, "Точка не найдена");
  const s = await prisma.shift.create({ data: { locationId, userId: user.id, openingCash: d.openingCash } });
  await safeAudit({ userId: user.id, action: "SHIFT_OPENED", entity: "Shift", entityId: s.id, newValue: { locationId, openingCash: d.openingCash } });
  return s.id;
}

export async function shiftSummary(shiftId: string) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { user: { select: { name: true } }, location: { select: { name: true } } } });
  if (!shift) return null;
  const orders = await prisma.order.findMany({ where: { shiftId }, include: { payments: true } });
  const sales = { count: 0, total: 0, discount: 0, cash: 0, card: 0, online: 0 };
  const refunds = { count: 0, total: 0, cash: 0, card: 0, online: 0 };
  const key = (m: string) => m.toLowerCase() as "cash" | "card" | "online";
  for (const o of orders) {
    if (o.status === "COMPLETED") {
      sales.count++; sales.total += Number(o.total); sales.discount += Number(o.discount);
      for (const p of o.payments) if (p.status === "PAID") sales[key(p.method)] += Number(p.amount);
    } else {
      const ref = o.payments.filter((p) => p.status === "REFUNDED");
      if (ref.length) refunds.count++;
      for (const p of ref) { refunds.total += Number(p.amount); refunds[key(p.method)] += Number(p.amount); }
    }
  }
  const opening = Number(shift.openingCash);
  const expectedCash = opening + sales.cash - refunds.cash;
  const closing = shift.closingCash == null ? null : Number(shift.closingCash);
  return {
    id: shift.id, status: shift.status, cashier: shift.user.name, location: shift.location.name, locationId: shift.locationId, userId: shift.userId,
    openedAt: shift.openedAt, closedAt: shift.closedAt, opening, closing, expectedCash,
    difference: closing == null ? null : closing - expectedCash, sales, refunds,
  };
}

export async function getShiftReport(shiftId: string, user: Actor) {
  const s = await shiftSummary(shiftId);
  if (!s) return null;
  const own = s.userId === user.id;
  const manager = can(user.role, "dashboard.view") && (canSwitchLocation(user.role) || user.locationId === s.locationId);
  return own || manager ? s : null;
}

export const closeShiftSchema = z.object({
  closingCash: z.preprocess(required, z.coerce.number({ error: "Укажите, сколько наличных в кассе" }).min(0, "Сумма не может быть отрицательной").max(1_000_000_000, "Слишком большая сумма")),
});

export async function closeShift(input: unknown, user: Actor) {
  const d = closeShiftSchema.parse(input);
  const shift = await getOpenShift(user.id);
  if (!shift) throw new ApiError(400, "Открытой смены нет");
  const before = await shiftSummary(shift.id);
  const r = await prisma.shift.updateMany({ where: { id: shift.id, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date(), closingCash: d.closingCash } });
  if (r.count === 0) throw new ApiError(400, "Смена уже закрыта");
  await safeAudit({ userId: user.id, action: "SHIFT_CLOSED", entity: "Shift", entityId: shift.id,
    newValue: { closingCash: d.closingCash, expectedCash: before?.expectedCash, difference: before ? d.closingCash - before.expectedCash : null, sales: before?.sales, refunds: before?.refunds } });
  return shift.id;
}

// ───────────── Каталог ─────────────
export async function getCatalog(locationId: string): Promise<PosCatalog> {
  const [cats, products, stock] = await Promise.all([
    prisma.category.findMany({ orderBy: { sort: "asc" } }),
    prisma.product.findMany({
      where: { isArchived: false },
      include: { recipe: { include: { items: true } }, modifiers: { include: { options: { orderBy: [{ priceDelta: "asc" }, { name: "asc" }] } } } },
      orderBy: { name: "asc" },
    }),
    usableStock(prisma, locationId),
  ]);
  const list: CatalogProduct[] = products.map((p) => {
    const items = p.recipe?.items ?? [];
    const portions = items.length
      ? Math.max(0, Math.min(...items.map((i) => Math.floor(Number(stock.get(i.ingredientId) ?? 0) / Number(i.quantity)))))
      : null;
    return {
      id: p.id, name: p.name, price: Number(p.price), categoryId: p.categoryId, image: p.image, isAvailable: p.isAvailable, portions,
      modifiers: p.modifiers.map((m) => ({ id: m.id, name: m.name, multiple: m.multiple, required: m.required,
        options: m.options.map((o) => ({ id: o.id, name: o.name, priceDelta: Number(o.priceDelta) })) })),
    };
  });
  const used = new Set(list.map((p) => p.categoryId));
  return { categories: cats.filter((c) => used.has(c.id)).map((c) => ({ id: c.id, name: c.name })), products: list };
}

// ───────────── Клиенты ─────────────
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 9) return `+998${d}`;
  if (d.length === 12 && d.startsWith("998")) return `+${d}`;
  if (raw.trim().startsWith("+") && d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}

export async function searchCustomers(q: string): Promise<CustomerLite[]> {
  const text = q.trim();
  if (text.length < 2) return [];
  const digits = text.replace(/\D/g, "");
  const rows = await prisma.customer.findMany({
    where: { OR: [{ name: { contains: text, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] },
    include: { loyalty: { select: { points: true } } }, orderBy: { name: "asc" }, take: 6,
  });
  return rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, points: c.loyalty?.points ?? 0 }));
}

export const quickCustomerSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя клиента").max(80, "Слишком длинное имя"),
  phone: z.string().trim().min(1, "Укажите телефон"),
});

export async function createQuickCustomer(input: unknown, user: Actor): Promise<CustomerLite> {
  const d = quickCustomerSchema.parse(input);
  const phone = normalizePhone(d.phone);
  if (!phone) throw new ApiError(400, "Введите телефон в формате +998 90 123 45 67");
  if (await prisma.customer.findUnique({ where: { phone } })) throw new ApiError(400, "Клиент с таким телефоном уже есть: найдите его через поиск");
  const c = await createCustomerTx(prisma, { name: d.name, phone });
  const points = (await prisma.loyaltyAccount.findUnique({ where: { customerId: c.id } }))?.points ?? 0;
  await safeAudit({ userId: user.id, action: "CUSTOMER_CREATED", entity: "Customer", entityId: c.id, newValue: { name: d.name, phone, welcomeBonus: points } });
  return { id: c.id, name: c.name, phone: c.phone, points };
}

// ───────────── Цены и скидки (считает только сервер) ─────────────
export const cartSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int("Некорректное количество").min(1, "Некорректное количество").max(50, "Слишком большое количество"),
    optionIds: z.array(z.string().min(1)).max(30),
  })).min(1, "Корзина пуста").max(40, "Слишком много позиций"),
  customerId: z.string().nullable().optional(),
  redeemPoints: z.number().int("Баллы — целое число").min(0, "Некорректное число баллов").max(100_000_000).optional(),
  promoCode: z.string().trim().max(40).nullable().optional(),
  manualDiscount: z.object({ type: z.enum(["PERCENT", "FIXED"]), value: z.number().positive("Скидка должна быть больше 0").max(1_000_000_000) }).nullable().optional(),
});
export type CartInput = z.infer<typeof cartSchema>;

export const orderSchema = cartSchema.extend({
  customerId: z.string().nullable().optional(),
  method: z.enum(["CASH", "CARD", "ONLINE"], { error: "Выберите способ оплаты" }),
  tendered: z.number().min(0).max(10_000_000_000).nullable().optional(),
});

export async function priceItems(db: Tx, items: CartItem[]) {
  const products = await db.product.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.productId))] } },
    include: { modifiers: { include: { options: true } } },
  });
  const pm = new Map(products.map((p) => [p.id, p]));
  const lines = items.map((it) => {
    const p = pm.get(it.productId);
    if (!p || p.isArchived || !p.isAvailable) throw new ApiError(400, `«${p?.name ?? "Продукт"}» сейчас недоступен`);
    const ids = [...new Set(it.optionIds)];
    const all = p.modifiers.flatMap((m) => m.options.map((o) => ({ o, m })));
    const chosen = ids.map((id) => {
      const f = all.find((x) => x.o.id === id);
      if (!f) throw new ApiError(400, "Выбранная опция недоступна, обновите страницу");
      return f;
    });
    for (const m of p.modifiers) {
      const n = chosen.filter((c) => c.m.id === m.id).length;
      if (m.required && n === 0) throw new ApiError(400, `Выберите «${m.name}» для «${p.name}»`);
      if (!m.multiple && n > 1) throw new ApiError(400, `«${m.name}»: можно выбрать только один вариант`);
    }
    const unitPrice = r2(Number(p.price) + chosen.reduce((a, c) => a + Number(c.o.priceDelta), 0));
    return {
      productId: p.id, name: p.name, quantity: it.quantity, unitPrice,
      modifiers: chosen.map((c) => ({ modifierId: c.m.id, optionId: c.o.id, name: c.o.name, priceDelta: Number(c.o.priceDelta) })),
    };
  });
  return { lines, subtotal: r2(lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0)) };
}

export async function computeDiscount(db: Tx, subtotal: number, d: Pick<CartInput, "promoCode" | "manualDiscount">, user: Actor) {
  const code = d.promoCode?.trim() || null;
  if (code && d.manualDiscount) throw new ApiError(400, "Нельзя применить промокод и ручную скидку одновременно");
  if (code) {
    const p = await db.promoCode.findFirst({ where: { code: { equals: code, mode: "insensitive" } } });
    if (!p || !p.isActive) throw new ApiError(400, "Промокод не найден или отключён");
    if (p.expiresAt && p.expiresAt < new Date()) throw new ApiError(400, "Срок действия промокода истёк");
    if (p.usageLimit != null && p.usedCount >= p.usageLimit) throw new ApiError(400, "Промокод уже использован максимальное число раз");
    if (subtotal < Number(p.minOrder)) throw new ApiError(400, `Минимальная сумма заказа для этого промокода: ${new Intl.NumberFormat("ru-RU").format(Number(p.minOrder))} UZS`);
    const raw = p.type === "PERCENT" ? (subtotal * Number(p.value)) / 100 : Number(p.value);
    return { discount: Math.min(Math.round(raw), Math.round(subtotal)), promoId: p.id, promoUsageLimit: p.usageLimit, promoCode: p.code, manual: null };
  }
  if (d.manualDiscount) {
    const { type, value } = d.manualDiscount;
    if (type === "PERCENT" && value > 100) throw new ApiError(400, "Скидка не может быть больше 100%");
    const raw = type === "PERCENT" ? (subtotal * value) / 100 : value;
    if (raw > subtotal + 0.001) throw new ApiError(400, "Скидка больше суммы заказа");
    const pct = subtotal > 0 ? (raw / subtotal) * 100 : 0;
    if (user.role === "CASHIER") {
      const s = await db.setting.findUnique({ where: { key: "pos.cashierMaxDiscountPct" } });
      const cap = (s?.value as number | undefined) ?? 10;
      if (pct > cap + 1e-9) throw new ApiError(400, `Кассир может дать скидку не более ${cap}%`);
    }
    return { discount: Math.round(raw), promoId: null, promoUsageLimit: null, promoCode: null, manual: d.manualDiscount };
  }
  return { discount: 0, promoId: null, promoUsageLimit: null, promoCode: null, manual: null };
}

/** Списание баллов: не больше баланса и не больше доли заказа из настроек. base — сумма после скидки. */
async function computeRedeem(db: Tx, customerId: string | null | undefined, requested: number | undefined, base: number) {
  const points = requested ?? 0;
  if (!customerId) {
    if (points > 0) throw new ApiError(400, "Выберите клиента, чтобы списать баллы");
    return { points: 0, amount: 0, max: 0, accountId: null as string | null };
  }
  const [acc, s] = await Promise.all([db.loyaltyAccount.findUnique({ where: { customerId } }), getLoyaltySettings(db)]);
  const balance = acc?.points ?? 0;
  const maxAmount = Math.floor((base * s.maxRedeemPct) / 100);
  const max = s.pointValue > 0 ? Math.max(0, Math.min(balance, Math.floor(maxAmount / s.pointValue))) : 0;
  if (points > 0) {
    if (points > balance) throw new ApiError(400, `У клиента только ${balance} баллов`);
    if (points > max) throw new ApiError(400, `Баллами можно оплатить не более ${s.maxRedeemPct}% заказа (до ${max} б.)`);
  }
  return { points, amount: Math.round(points * s.pointValue), max, accountId: acc?.id ?? null };
}

export async function quote(input: unknown, user: Actor): Promise<{ subtotal: number; discount: number; total: number; pointsAmount: number; maxRedeemPoints: number }> {
  const d = cartSchema.parse(input);
  const { subtotal } = await priceItems(prisma, d.items);
  const disc = await computeDiscount(prisma, subtotal, d, user);
  const rd = await computeRedeem(prisma, d.customerId, d.redeemPoints, subtotal - disc.discount);
  return { subtotal, discount: disc.discount + rd.amount, total: r2(subtotal - disc.discount - rd.amount), pointsAmount: rd.amount, maxRedeemPoints: rd.max };
}

// ───────────── Создание заказа ─────────────
export async function createPosOrder(input: unknown, user: Actor): Promise<Extract<OrderResult, { ok: true }>> {
  const d = orderSchema.parse(input);
  const res = await retryOnConflict(() => prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findFirst({ where: { userId: user.id, status: "OPEN" } });
    if (!shift) throw new ApiError(400, "Сначала откройте смену");
    const locationId = shift.locationId;
    await lockStock(tx, locationId);
    if (d.customerId && !(await tx.customer.findUnique({ where: { id: d.customerId } }))) throw new ApiError(404, "Клиент не найден");

    const { lines, subtotal } = await priceItems(tx, d.items);
    await assertInStock(tx, locationId, d.items);
    const disc = await computeDiscount(tx, subtotal, d, user);
    const rd = await computeRedeem(tx, d.customerId, d.redeemPoints, subtotal - disc.discount);
    const total = r2(subtotal - disc.discount - rd.amount);
    if (d.method === "CASH" && d.tendered != null && d.tendered < total) throw new ApiError(400, "Принятая сумма меньше суммы заказа");

    if (disc.promoId) {
      if (disc.promoUsageLimit != null) {
        const u = await tx.promoCode.updateMany({ where: { id: disc.promoId, usedCount: { lt: disc.promoUsageLimit } }, data: { usedCount: { increment: 1 } } });
        if (u.count === 0) throw new ApiError(400, "Промокод уже использован максимальное число раз");
      } else {
        await tx.promoCode.update({ where: { id: disc.promoId }, data: { usedCount: { increment: 1 } } });
      }
    }

    if (rd.points > 0) {
      const u = await tx.loyaltyAccount.updateMany({ where: { id: rd.accountId!, points: { gte: rd.points } }, data: { points: { decrement: rd.points } } });
      if (u.count === 0) throw new ApiError(400, "Недостаточно баллов у клиента");
    }
    const order = await tx.order.create({
      data: {
        locationId, customerId: d.customerId ?? null, cashierId: user.id, shiftId: shift.id, source: "POS", fulfillment: "PICKUP", status: "CONFIRMED",
        subtotal, discount: disc.discount + rd.amount, pointsSpent: rd.points, deliveryFee: 0, total, promoCode: disc.promoCode,
        items: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, modifiers: l.modifiers })) },
        payments: { create: { method: d.method, status: "PAID", amount: total } },
      },
    });
    if (rd.points > 0) await tx.loyaltyTransaction.create({ data: { accountId: rd.accountId!, type: "SPEND", points: -rd.points, orderId: order.id, note: `Оплата баллами, заказ №${order.number}` } });
    const done = await fulfillOrderTx(tx, order.id, user.id);
    return { order, done, rd, discount: disc.discount, total, manual: disc.manual, promo: disc.promoCode, subtotal };
  }, { timeout: 20000, maxWait: 10000 }));

  await safeAudit({ userId: user.id, action: "POS_ORDER_CREATED", entity: "Order", entityId: res.order.id,
    newValue: { number: res.order.number, total: res.total, method: d.method, discount: res.discount, pointsSpent: res.rd.points, promo: res.promo, manualDiscount: res.manual } });
  if (res.manual) await safeAudit({ userId: user.id, action: "MANUAL_DISCOUNT", entity: "Order", entityId: res.order.id, newValue: { ...res.manual, amount: res.discount, subtotal: res.subtotal } });

  return {
    ok: true, orderId: res.order.id, number: res.order.number, total: res.total, discount: res.discount + res.rd.amount, pointsSpent: res.rd.points, method: d.method,
    change: d.method === "CASH" && d.tendered != null ? r2(d.tendered - res.total) : 0, pointsEarned: res.done.pointsEarned,
  };
}

// ───────────── Возврат ─────────────
export const refundSchema = z.object({ orderId: z.string().min(1), reason: z.string().trim().min(3, "Укажите причину возврата").max(200, "Слишком длинная причина") });

/** Возврат оплаченного заказа. Ингредиенты на склад не возвращаются (продукт приготовлен), баллы клиента сторнируются. */
export async function refundOrder(input: unknown, user: Actor) {
  const d = refundSchema.parse(input);
  const info = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: d.orderId }, include: { payments: true } });
    if (!o) throw new ApiError(404, "Заказ не найден");
    if (!canSwitchLocation(user.role) && user.locationId !== o.locationId) throw new ApiError(404, "Заказ не найден");
    const lock = await tx.order.updateMany({ where: { id: o.id, status: "COMPLETED" }, data: { status: "CANCELLED" } });
    if (lock.count === 0) throw new ApiError(400, "Этот заказ нельзя вернуть: он не завершён или уже возвращён");
    await tx.payment.updateMany({ where: { orderId: o.id, status: "PAID" }, data: { status: "REFUNDED" } });
    if (o.customerId && o.pointsEarned > 0) {
      const acc = await tx.loyaltyAccount.findUnique({ where: { customerId: o.customerId } });
      if (acc) {
        const take = Math.min(acc.points, o.pointsEarned);
        await tx.loyaltyAccount.update({ where: { id: acc.id }, data: { points: { decrement: take } } });
        await tx.loyaltyTransaction.create({ data: { accountId: acc.id, type: "ADJUST", points: -take, orderId: o.id, note: `Возврат заказа №${o.number}` } });
      }
    }
    if (o.customerId && o.pointsSpent > 0) {
      const acc = await tx.loyaltyAccount.upsert({ where: { customerId: o.customerId }, create: { customerId: o.customerId, points: o.pointsSpent }, update: { points: { increment: o.pointsSpent } } });
      await tx.loyaltyTransaction.create({ data: { accountId: acc.id, type: "ADJUST", points: o.pointsSpent, orderId: o.id, note: `Возврат баллов, заказ №${o.number}` } });
    }
    return { number: o.number, total: Number(o.total) };
  });
  await safeAudit({ userId: user.id, action: "ORDER_REFUNDED", entity: "Order", entityId: d.orderId, oldValue: { status: "COMPLETED" }, newValue: { status: "CANCELLED", reason: d.reason, total: info.total } });
  return info;
}

export async function recentOrders(user: Actor): Promise<RecentOrder[]> {
  const shift = await getOpenShift(user.id);
  if (!shift) return [];
  const rows = await prisma.order.findMany({
    where: { shiftId: shift.id }, orderBy: { createdAt: "desc" }, take: 15,
    include: { payments: true, items: { include: { product: { select: { name: true } } } } },
  });
  const canRefund = can(user.role, "pos.refund");
  return rows.map((o) => ({
    id: o.id, number: o.number, total: Number(o.total), status: o.status, method: o.payments[0]?.method ?? null,
    createdAt: o.createdAt.toISOString(),
    summary: o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", "),
    refundable: canRefund && o.status === "COMPLETED",
  }));
}
