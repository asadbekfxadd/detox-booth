import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/**
 * Click, Shop API: Click вызывает наш адрес /api/payments/click дважды — prepare (action=0) и complete (action=1).
 * Подпись: md5 от склейки полей и секретного ключа сервиса. Заказ определяется merchant_trans_id (id заказа).
 */
export type ClickConfig = { serviceId: string; merchantId: string; secretKey: string };

export function clickConfig(env: NodeJS.ProcessEnv = process.env): ClickConfig | null {
  const serviceId = env.CLICK_SERVICE_ID?.trim(), merchantId = env.CLICK_MERCHANT_ID?.trim(), secretKey = env.CLICK_SECRET_KEY?.trim();
  if (!serviceId || !merchantId || !secretKey) return null;
  return { serviceId, merchantId, secretKey };
}

export function clickCheckoutUrl(cfg: ClickConfig, p: { orderId: string; amountUzs: number; returnUrl: string }): string {
  const q = new URLSearchParams({ service_id: cfg.serviceId, merchant_id: cfg.merchantId, amount: String(p.amountUzs), transaction_param: p.orderId, return_url: p.returnUrl });
  return `https://my.click.uz/services/pay?${q.toString()}`;
}

export type ClickBody = Record<string, string>;
const md5 = (s: string) => createHash("md5").update(s).digest("hex");

/** Подпись запроса. Для complete в строку входит ещё merchant_prepare_id. */
export function clickSign(b: ClickBody, secretKey: string): string {
  const prepareId = b.action === "1" ? (b.merchant_prepare_id ?? "") : "";
  return md5(`${b.click_trans_id}${b.service_id}${secretKey}${b.merchant_trans_id}${prepareId}${b.amount}${b.action}${b.sign_time}`);
}
export function clickSignOk(b: ClickBody, secretKey: string): boolean {
  const got = Buffer.from(String(b.sign_string ?? "").toLowerCase()), want = Buffer.from(clickSign(b, secretKey));
  return got.length === want.length && timingSafeEqual(got, want);
}

const ERR = { sign: -1, amount: -2, action: -3, paid: -4, noOrder: -5, noTx: -6, update: -7, request: -8, cancelled: -9 } as const;
const NOTE: Record<number, string> = { [-1]: "SIGN CHECK FAILED!", [-2]: "Incorrect parameter amount", [-3]: "Action not found", [-4]: "Already paid", [-5]: "User does not exist", [-6]: "Transaction does not exist", [-7]: "Failed to update user", [-8]: "Error in request from click", [-9]: "Transaction cancelled", 0: "Success" };

/** Разбирает form-urlencoded тело в плоский объект строк. */
export const parseClickBody = (raw: string): ClickBody => Object.fromEntries(new URLSearchParams(raw).entries());

export async function handleClick(b: ClickBody, cfg: ClickConfig) {
  const base = { click_trans_id: b.click_trans_id ?? null, merchant_trans_id: b.merchant_trans_id ?? null };
  const reply = (error: number, extra: Record<string, unknown> = {}) => ({ ...base, ...extra, error, error_note: NOTE[error] ?? "Error" });
  const required = ["click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time", "sign_string"];
  if (required.some((k) => !b[k])) return reply(ERR.request);
  if (b.service_id !== cfg.serviceId) return reply(ERR.request);
  if (b.action === "1" && !b.merchant_prepare_id) return reply(ERR.request);
  if (!clickSignOk(b, cfg.secretKey)) return reply(ERR.sign);
  if (b.action !== "0" && b.action !== "1") return reply(ERR.action);
  const amount = Number(b.amount);
  if (!Number.isFinite(amount)) return reply(ERR.request);

  const order = await prisma.order.findUnique({ where: { id: b.merchant_trans_id }, include: { payments: true } });
  const pay = order?.payments.find((p) => p.provider === "click");
  if (!order || !pay) return reply(ERR.noOrder);
  if (Math.round(amount * 100) !== Math.round(Number(pay.amount) * 100)) return reply(ERR.amount);

  if (b.action === "0") {
    return prisma.$transaction(async (db) => {
      await db.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"click:" + order.id}))`);
      const existing = await db.clickTransaction.findUnique({ where: { clickTransId: b.click_trans_id } });
      if (existing) {
        if (existing.status === "COMPLETED") return reply(ERR.paid);
        if (existing.status === "CANCELLED") return reply(ERR.cancelled);
        return reply(0, { merchant_prepare_id: existing.id });
      }
      if (pay.status === "PAID") return reply(ERR.paid);
      if (pay.status !== "PENDING" || order.status === "CANCELLED") return reply(ERR.cancelled);
      const t = await db.clickTransaction.create({ data: { clickTransId: b.click_trans_id, orderId: order.id, amount: pay.amount, status: "PREPARED" } });
      return reply(0, { merchant_prepare_id: t.id });
    }, { timeout: 15000 });
  }

  // complete
  const r = await prisma.$transaction(async (db) => {
    await db.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"click:" + order.id}))`);
    const t = await db.clickTransaction.findUnique({ where: { clickTransId: b.click_trans_id } });
    if (!t || String(t.id) !== b.merchant_prepare_id || t.orderId !== order.id) return { res: reply(ERR.noTx), paid: false };
    if (t.status === "COMPLETED") return { res: reply(ERR.paid), paid: false };
    if (t.status === "CANCELLED") return { res: reply(ERR.cancelled), paid: false };
    // Click сообщает о неуспешной оплате отрицательным error
    if (Number(b.error ?? 0) < 0) {
      await db.clickTransaction.update({ where: { id: t.id }, data: { status: "CANCELLED" } });
      return { res: reply(ERR.cancelled, { merchant_confirm_id: t.id }), paid: false };
    }
    if (order.status === "CANCELLED") return { res: reply(ERR.cancelled), paid: false };
    await db.clickTransaction.update({ where: { id: t.id }, data: { status: "COMPLETED" } });
    await db.payment.updateMany({ where: { orderId: order.id, provider: "click", status: "PENDING" }, data: { status: "PAID", externalId: b.click_trans_id } });
    return { res: reply(0, { merchant_confirm_id: t.id }), paid: true };
  }, { timeout: 15000 });
  if (r.paid) await audit({ action: "PAYMENT_CONFIRMED", entity: "Order", entityId: order.id, newValue: { provider: "click", externalId: b.click_trans_id } });
  return r.res;
}
