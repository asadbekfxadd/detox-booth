import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertInStock, assertSellableOnSite } from "@/services/availability";
import { createCustomerTx } from "@/lib/services/loyalty";
import { checkScheduled } from "@/lib/slots";
import { enabledProviders, repayUrl } from "@/services/payments";
import { siteUrl } from "@/lib/site-url";
import { priceItems, discountWithPromotions, normalizePhone, cartSchema } from "@/services/pos";
import { recordUses, type Applied } from "@/services/promotions";
import { quoteDelivery } from "@/lib/delivery";
import { mixFromModifiers } from "@/lib/mix";
import { notifyOrder } from "@/services/telegram";

const r2 = (n: number) => Math.round(n * 100) / 100;
const WEB_ACTOR = { id: "web", role: "BARISTA" as Role, locationId: null }; // ручных скидок на сайте нет

async function safeAudit(p: Parameters<typeof audit>[0]) {
  try { await audit(p); } catch (e) { console.error("[AUDIT ERROR]", e); }
}
async function setting<T>(key: string, fallback: T): Promise<T> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return (s?.value as T | undefined) ?? fallback;
}

export const quoteSchema = z.object({
  items: cartSchema.shape.items,
  promoCode: z.string().trim().max(40).nullable().optional(),
  fulfillment: z.enum(["PICKUP", "DELIVERY"]),
  /** Зона доставки (если у точки они настроены) */
  zoneId: z.string().max(40).nullable().optional(),
  /** Телефон, если гость уже его ввёл: нужен, чтобы применить акцию «на первый заказ» */
  phone: z.string().trim().max(30).nullable().optional(),
});
export type WebQuote = { subtotal: number; discount: number; deliveryFee: number; freeDelivery: boolean; total: number; points: number; promoCode: string | null; promotions: Applied[]; hints: { id: string; name: string; text: string }[] };

/**
 * Цена доставки. Если у точки настроены зоны — клиент обязан выбрать зону (цена, минимальный заказ, бесплатно от суммы).
 * Зон нет — одна общая цена из настроек, как раньше. amount — сумма заказа после скидки.
 */
async function resolveDelivery(db: typeof prisma, locationId: string, zoneId: string | null | undefined, amount: number): Promise<{ fee: number; zoneId: string | null; free: boolean }> {
  const zones = await db.deliveryZone.findMany({ where: { locationId, isActive: true } });
  if (zones.length === 0) return { fee: await setting("delivery.fee", 0), zoneId: null, free: false };
  if (!zoneId) throw new ApiError(400, "Выберите зону доставки");
  const z = zones.find((x) => x.id === zoneId);
  if (!z) throw new ApiError(400, "Эта зона доставки недоступна, выберите другую");
  const q = quoteDelivery({ id: z.id, name: z.name, fee: Number(z.fee), minOrder: Number(z.minOrder), freeFrom: z.freeFrom == null ? null : Number(z.freeFrom) }, amount);
  if (!q.ok) throw new ApiError(400, q.error);
  return { fee: q.fee, zoneId: z.id, free: q.free };
}

export async function quoteWeb(input: unknown, locationId: string | null): Promise<WebQuote> {
  const d = quoteSchema.parse(input);
  if (!locationId) throw new ApiError(400, "Выберите точку");
  const { lines, subtotal } = await priceItems(prisma, d.items);
  await assertSellableOnSite(prisma, d.items);
  await assertInStock(prisma, locationId, d.items);
  const x = await discountWithPromotions(prisma, lines, subtotal, { promoCode: d.promoCode, manualDiscount: null }, WEB_ACTOR, { channel: "SITE", phone: d.phone ? normalizePhone(d.phone) : null });
  const dl = d.fulfillment === "DELIVERY" ? await resolveDelivery(prisma, locationId, d.zoneId, r2(subtotal - x.discount)) : { fee: 0, zoneId: null, free: false };
  const deliveryFee = dl.fee;
  const total = r2(subtotal - x.discount + deliveryFee);
  const rate = await setting("loyalty.earnRate", 1);
  return { subtotal, discount: x.discount, deliveryFee, freeDelivery: dl.free, total, points: Math.floor(total * rate), promoCode: x.disc.promoCode, promotions: x.promo.applied, hints: x.promo.hints };
}

export const checkoutSchema = quoteSchema.extend({
  name: z.string().trim().min(2, "Укажите имя").max(80, "Слишком длинное имя"),
  phone: z.string().trim().min(1, "Укажите телефон"),
  address: z.string().trim().max(200, "Слишком длинный адрес").optional(),
  method: z.enum(["CASH", "CARD", "ONLINE"], { error: "Выберите способ оплаты" }),
  /** Платёжный сервис для онлайн-оплаты (payme, click); не указан — первый из подключённых */
  provider: z.string().max(20).optional(),
  referrerPhone: z.string().trim().max(30).optional(),
  /** ISO-время получения; нет — «как можно скорее» */
  scheduledFor: z.string().max(40).nullable().optional(),
  note: z.string().trim().max(300, "Комментарий слишком длинный").optional(),
});

/** tg — пользователь Telegram (из проверенных данных Mini App): заказ привяжется к его чату, чтобы бот писал о статусе. */
export async function createWebOrder(input: unknown, locationId: string | null, tg: { id: string } | null = null) {
  const d = checkoutSchema.parse(input);
  if (!locationId) throw new ApiError(400, "Выберите точку");
  const phone = normalizePhone(d.phone);
  if (!phone) throw new ApiError(400, "Введите телефон в формате +998 90 123 45 67");
  if (d.fulfillment === "DELIVERY" && (d.address?.length ?? 0) < 6) throw new ApiError(400, "Укажите адрес доставки");
  const online = d.method === "ONLINE" ? enabledProviders() : [];
  const provider = online.find((p) => p.id === d.provider) ?? online[0] ?? null;
  if (d.method === "ONLINE" && !provider) throw new ApiError(400, "Онлайн-оплата сейчас недоступна. Выберите оплату при получении.");
  let scheduledFor: Date | null = null;
  if (d.scheduledFor) {
    const chk = checkScheduled(d.scheduledFor, Date.now(), await setting("orders.minLeadMinutes", 15));
    if (!chk.ok) throw new ApiError(400, chk.error);
    scheduledFor = chk.at;
  }
  if (!(await prisma.location.findFirst({ where: { id: locationId, isActive: true } }))) throw new ApiError(400, "Эта точка сейчас не принимает заказы");

  let customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) {
    // реферал учитываем только для нового клиента; если друг не найден — молча игнорируем (не раскрываем, кто у нас клиент)
    const rp = d.referrerPhone ? normalizePhone(d.referrerPhone) : null;
    const referredById = rp && rp !== phone ? (await prisma.customer.findUnique({ where: { phone: rp }, select: { id: true } }))?.id ?? null : null;
    try { customer = await createCustomerTx(prisma, { name: d.name, phone, referredById }); }
    catch (e) {
      if ((e as { code?: string } | null)?.code !== "P2002") throw e;
      customer = await prisma.customer.findUniqueOrThrow({ where: { phone } }); // параллельный заказ с того же номера
    }
  }
  // защита от спама: не больше 3 неподтверждённых заказов от одного номера за 30 минут
  const pending = await prisma.order.count({ where: { customerId: customer.id, source: "WEB", status: "NEW", createdAt: { gte: new Date(Date.now() - 30 * 60000) } } });
  if (pending >= 3) throw new ApiError(400, "У вас уже есть неподтверждённые заказы. Подождите, пока точка их подтвердит.");

  const order = await prisma.$transaction(async (tx) => {
    const { lines, subtotal } = await priceItems(tx, d.items);
    await assertSellableOnSite(tx, d.items);
    await assertInStock(tx, locationId, d.items);
    const x = await discountWithPromotions(tx, lines, subtotal, { promoCode: d.promoCode, manualDiscount: null, customerId: customer.id }, WEB_ACTOR, { channel: "SITE", phone });
    const disc = { ...x.disc, discount: x.discount };
    const dl = d.fulfillment === "DELIVERY" ? await resolveDelivery(tx as unknown as typeof prisma, locationId, d.zoneId, r2(subtotal - disc.discount)) : { fee: 0, zoneId: null, free: false };
    const deliveryFee = dl.fee;
    const total = r2(subtotal - disc.discount + deliveryFee);
    if (disc.promoId) {
      if (disc.promoUsageLimit != null) {
        const u = await tx.promoCode.updateMany({ where: { id: disc.promoId, usedCount: { lt: disc.promoUsageLimit } }, data: { usedCount: { increment: 1 } } });
        if (u.count === 0) throw new ApiError(400, "Промокод уже использован максимальное число раз");
      } else await tx.promoCode.update({ where: { id: disc.promoId }, data: { usedCount: { increment: 1 } } });
    }
    const created = await tx.order.create({
      data: {
        locationId, customerId: customer.id, source: "WEB", fulfillment: d.fulfillment, status: "NEW", telegramId: tg?.id ?? null,
        subtotal, discount: disc.discount, deliveryFee, deliveryZoneId: dl.zoneId, total, promoCode: disc.promoCode,
        address: d.fulfillment === "DELIVERY" ? d.address : null, scheduledFor, note: d.note || null,
        items: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, modifiers: l.modifiers })) },
        payments: { create: { method: d.method, status: "PENDING", amount: total, provider: provider?.id ?? null } },
      },
    });
    await recordUses(tx, created.id, customer.id, x.promo.applied);
    return created;
  }, { timeout: 20000, maxWait: 10000 });

  let payUrl: string | null = null;
  if (provider) {
    try {
      const chk = await provider.createCheckout({ orderId: order.id, orderNumber: order.number, amount: Number(order.total), returnUrl: `${siteUrl()}/order/${order.id}` });
      await prisma.payment.updateMany({ where: { orderId: order.id }, data: { externalId: chk.externalId } });
      payUrl = chk.redirectUrl;
    } catch (e) {
      console.error("[PAYMENT CHECKOUT]", e);
      await prisma.order.updateMany({ where: { id: order.id, status: "NEW" }, data: { status: "CANCELLED" } });
      await prisma.payment.updateMany({ where: { orderId: order.id }, data: { status: "FAILED" } });
      throw new ApiError(502, "Не удалось создать платёж. Попробуйте ещё раз или выберите оплату при получении.");
    }
  }
  await safeAudit({ action: "WEB_ORDER_CREATED", entity: "Order", entityId: order.id, newValue: { number: order.number, total: Number(order.total), fulfillment: d.fulfillment, method: d.method, promo: order.promoCode } });
  if (tg) void notifyOrder(order.id, "created");
  return { orderId: order.id, number: order.number, payUrl };
}

/** Публичная страница заказа: открывается по длинному неугадываемому id, персональные данные не показываем. */
export async function getPublicOrder(id: string) {
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return null;
  const o = await prisma.order.findFirst({
    where: { id, source: "WEB" },
    include: { location: { select: { name: true, address: true } }, customer: { select: { name: true } }, courier: { select: { name: true } }, payments: true, items: { include: { product: { select: { name: true } } } } },
  });
  if (!o) return null;
  const pay = o.payments[0];
  return {
    id: o.id, number: o.number, status: o.status, fulfillment: o.fulfillment, address: o.address, createdAt: o.createdAt, scheduledFor: o.scheduledFor, note: o.note,
    location: o.location, customerName: o.customer?.name.split(" ")[0] ?? null,
    courierName: o.courier?.name.split(" ")[0] ?? null, pickedUp: !!o.pickedUpAt,
    subtotal: Number(o.subtotal), discount: Number(o.discount), deliveryFee: Number(o.deliveryFee), total: Number(o.total), promoCode: o.promoCode, pointsEarned: o.pointsEarned,
    payment: pay ? { method: pay.method, status: pay.status } : null,
    payUrl: pay && pay.method === "ONLINE" && pay.status === "PENDING" && o.status === "NEW" ? repayUrl(pay.provider, { orderId: o.id, amount: Number(pay.amount), returnUrl: `${siteUrl()}/order/${o.id}` }) : null,
    items: o.items.map((i) => ({
      id: i.id, productId: i.productId, name: i.product.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), mix: mixFromModifiers(i.modifiers) ?? undefined,
      optionIds: (Array.isArray(i.modifiers) ? (i.modifiers as unknown as { optionId?: string }[]) : []).map((m) => m?.optionId).filter((x): x is string => typeof x === "string"),
      options: (Array.isArray(i.modifiers) ? (i.modifiers as unknown as { name?: string }[]) : []).map((m) => m?.name).filter((x): x is string => !!x),
    })),
  };
}

/** Краткая история заказов по списку id из браузера клиента. Неверные id пропускаются, максимум 10. */
export async function getOrdersBrief(ids: unknown, telegramId: string | null = null) {
  const list = (Array.isArray(ids) ? ids : []).filter((x): x is string => typeof x === "string" && /^[a-z0-9]{20,40}$/i.test(x)).slice(0, 10);
  if (list.length === 0 && !telegramId) return [];
  // в Telegram история хранится на сервере: заказы видны на любом устройстве, где открыт бот
  const rows = await prisma.order.findMany({
    where: { source: "WEB", OR: [{ id: { in: list } }, ...(telegramId ? [{ telegramId }] : [])] },
    orderBy: { createdAt: "desc" }, take: 20,
    include: { location: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
  });
  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map((o) => ({
      id: o.id, number: o.number, status: o.status, createdAt: o.createdAt, total: Number(o.total), location: o.location.name,
      summary: o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", "),
      repeat: o.items.map((i) => ({
        productId: i.productId, quantity: i.quantity, mix: mixFromModifiers(i.modifiers) ?? undefined,
        optionIds: (Array.isArray(i.modifiers) ? (i.modifiers as unknown as { optionId?: string }[]) : []).map((m) => m?.optionId).filter((x): x is string => typeof x === "string"),
      })),
    }));
}
export type OrderBrief = Awaited<ReturnType<typeof getOrdersBrief>>[number];
