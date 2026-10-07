import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { assertInStock } from "@/services/availability";
import { createCustomerTx } from "@/lib/services/loyalty";
import { priceItems, computeDiscount, normalizePhone, cartSchema } from "@/services/pos";

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
});
export type WebQuote = { subtotal: number; discount: number; deliveryFee: number; total: number; points: number; promoCode: string | null };

export async function quoteWeb(input: unknown, locationId: string | null): Promise<WebQuote> {
  const d = quoteSchema.parse(input);
  if (!locationId) throw new ApiError(400, "Выберите точку");
  const { subtotal } = await priceItems(prisma, d.items);
  await assertInStock(prisma, locationId, d.items);
  const disc = await computeDiscount(prisma, subtotal, { promoCode: d.promoCode, manualDiscount: null }, WEB_ACTOR);
  const deliveryFee = d.fulfillment === "DELIVERY" ? await setting("delivery.fee", 0) : 0;
  const total = r2(subtotal - disc.discount + deliveryFee);
  const rate = await setting("loyalty.earnRate", 1);
  return { subtotal, discount: disc.discount, deliveryFee, total, points: Math.floor(total * rate), promoCode: disc.promoCode };
}

export const checkoutSchema = quoteSchema.extend({
  name: z.string().trim().min(2, "Укажите имя").max(80, "Слишком длинное имя"),
  phone: z.string().trim().min(1, "Укажите телефон"),
  address: z.string().trim().max(200, "Слишком длинный адрес").optional(),
  method: z.enum(["CASH", "CARD"], { error: "Выберите способ оплаты" }),
  referrerPhone: z.string().trim().max(30).optional(),
});

export async function createWebOrder(input: unknown, locationId: string | null) {
  const d = checkoutSchema.parse(input);
  if (!locationId) throw new ApiError(400, "Выберите точку");
  const phone = normalizePhone(d.phone);
  if (!phone) throw new ApiError(400, "Введите телефон в формате +998 90 123 45 67");
  if (d.fulfillment === "DELIVERY" && (d.address?.length ?? 0) < 6) throw new ApiError(400, "Укажите адрес доставки");
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

  const deliveryFee = d.fulfillment === "DELIVERY" ? await setting("delivery.fee", 0) : 0;
  const order = await prisma.$transaction(async (tx) => {
    const { lines, subtotal } = await priceItems(tx, d.items);
    await assertInStock(tx, locationId, d.items);
    const disc = await computeDiscount(tx, subtotal, { promoCode: d.promoCode, manualDiscount: null }, WEB_ACTOR);
    const total = r2(subtotal - disc.discount + deliveryFee);
    if (disc.promoId) {
      if (disc.promoUsageLimit != null) {
        const u = await tx.promoCode.updateMany({ where: { id: disc.promoId, usedCount: { lt: disc.promoUsageLimit } }, data: { usedCount: { increment: 1 } } });
        if (u.count === 0) throw new ApiError(400, "Промокод уже использован максимальное число раз");
      } else await tx.promoCode.update({ where: { id: disc.promoId }, data: { usedCount: { increment: 1 } } });
    }
    return tx.order.create({
      data: {
        locationId, customerId: customer.id, source: "WEB", fulfillment: d.fulfillment, status: "NEW",
        subtotal, discount: disc.discount, deliveryFee, total, promoCode: disc.promoCode,
        address: d.fulfillment === "DELIVERY" ? d.address : null,
        items: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, modifiers: l.modifiers })) },
        payments: { create: { method: d.method, status: "PENDING", amount: total } },
      },
    });
  }, { timeout: 20000, maxWait: 10000 });

  await safeAudit({ action: "WEB_ORDER_CREATED", entity: "Order", entityId: order.id, newValue: { number: order.number, total: Number(order.total), fulfillment: d.fulfillment, method: d.method, promo: order.promoCode } });
  return { orderId: order.id, number: order.number };
}

/** Публичная страница заказа: открывается по длинному неугадываемому id, персональные данные не показываем. */
export async function getPublicOrder(id: string) {
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return null;
  const o = await prisma.order.findFirst({
    where: { id, source: "WEB" },
    include: { location: { select: { name: true, address: true } }, customer: { select: { name: true } }, payments: true, items: { include: { product: { select: { name: true } } } } },
  });
  if (!o) return null;
  const pay = o.payments[0];
  return {
    id: o.id, number: o.number, status: o.status, fulfillment: o.fulfillment, address: o.address, createdAt: o.createdAt,
    location: o.location, customerName: o.customer?.name.split(" ")[0] ?? null,
    subtotal: Number(o.subtotal), discount: Number(o.discount), deliveryFee: Number(o.deliveryFee), total: Number(o.total), promoCode: o.promoCode, pointsEarned: o.pointsEarned,
    payment: pay ? { method: pay.method, status: pay.status } : null,
    items: o.items.map((i) => ({
      id: i.id, name: i.product.name, quantity: i.quantity, unitPrice: Number(i.unitPrice),
      options: (Array.isArray(i.modifiers) ? (i.modifiers as unknown as { name?: string }[]) : []).map((m) => m?.name).filter((x): x is string => !!x),
    })),
  };
}
