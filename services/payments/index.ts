import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { createTestProvider } from "./test-provider";
import { paymeConfig, paymeCheckoutUrl } from "./payme";
import { clickConfig, clickCheckoutUrl } from "./click";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";

/**
 * Включённые провайдеры: PAYMENT_PROVIDERS="payme,click" (через запятую). Пусто — онлайн-оплаты нет, на сайте только оплата при получении.
 * - payme: PAYME_MERCHANT_ID, PAYME_KEY (и PAYME_TEST=1 для тестовой кассы)
 * - click: CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY
 * - test: PAYMENT_WEBHOOK_SECRET — только для проверки цепочки без реального сервиса
 * Payme и Click сами обращаются к нашим адресам /api/payments/payme и /api/payments/click, общий вебхук им не нужен.
 */
export function enabledProviders(env: NodeJS.ProcessEnv = process.env): PaymentProvider[] {
  const ids = (env.PAYMENT_PROVIDERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const out: PaymentProvider[] = [];
  for (const id of ids) {
    if (id === "test") {
      const secret = env.PAYMENT_WEBHOOK_SECRET;
      if (!secret || secret.length < 16) { console.error("[PAYMENTS] test: нужен PAYMENT_WEBHOOK_SECRET (минимум 16 символов), провайдер отключён"); continue; }
      out.push(createTestProvider(secret));
    } else if (id === "payme") {
      const cfg = paymeConfig(env);
      if (!cfg) { console.error("[PAYMENTS] payme: нужны PAYME_MERCHANT_ID и PAYME_KEY, провайдер отключён"); continue; }
      out.push({
        id: "payme", label: "Payme",
        async createCheckout(i) { return { externalId: `payme:${i.orderId}`, redirectUrl: paymeCheckoutUrl(cfg, { orderId: i.orderId, amountUzs: i.amount, returnUrl: i.returnUrl }) }; },
      });
    } else if (id === "click") {
      const cfg = clickConfig(env);
      if (!cfg) { console.error("[PAYMENTS] click: нужны CLICK_SERVICE_ID, CLICK_MERCHANT_ID и CLICK_SECRET_KEY, провайдер отключён"); continue; }
      out.push({
        id: "click", label: "Click",
        async createCheckout(i) { return { externalId: `click:${i.orderId}`, redirectUrl: clickCheckoutUrl(cfg, { orderId: i.orderId, amountUzs: i.amount, returnUrl: i.returnUrl }) }; },
      });
    }
  }
  return out;
}
/** Ссылка, чтобы оплатить заказ ещё раз (клиент закрыл страницу оплаты или платёж не прошёл). Только для Payme и Click. */
export function repayUrl(providerId: string | null, o: { orderId: string; amount: number; returnUrl: string }, env: NodeJS.ProcessEnv = process.env): string | null {
  if (providerId === "payme") { const cfg = paymeConfig(env); return cfg ? paymeCheckoutUrl(cfg, { orderId: o.orderId, amountUzs: o.amount, returnUrl: o.returnUrl }) : null; }
  if (providerId === "click") { const cfg = clickConfig(env); return cfg ? clickCheckoutUrl(cfg, { orderId: o.orderId, amountUzs: o.amount, returnUrl: o.returnUrl }) : null; }
  return null;
}
export const getProvider = (id: string) => enabledProviders().find((p) => p.id === id) ?? null;

/**
 * Применяет результат оплаты от провайдера. Идемпотентно: повторный вебхук ничего не меняет.
 * Переводит платёж из PENDING в PAID/FAILED; дальше заказ идёт обычным путём (подтверждение, кухня).
 */
export async function applyPaymentResult(providerId: string, externalId: string, status: "PAID" | "FAILED", amount?: number) {
  const pay = await prisma.payment.findUnique({ where: { provider_externalId: { provider: providerId, externalId } } });
  if (!pay) return { ok: false as const, reason: "not_found" as const };
  if (status === "PAID" && amount != null && Math.round(amount) !== Math.round(Number(pay.amount))) return { ok: false as const, reason: "amount_mismatch" as const };
  const r = await prisma.payment.updateMany({ where: { id: pay.id, status: "PENDING" }, data: { status } });
  if (r.count === 0) return { ok: true as const, changed: false as const };
  await audit({ action: status === "PAID" ? "PAYMENT_CONFIRMED" : "PAYMENT_FAILED", entity: "Order", entityId: pay.orderId, newValue: { provider: providerId, externalId } });
  return { ok: true as const, changed: true as const };
}
