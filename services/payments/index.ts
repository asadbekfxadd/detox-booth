import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { createTestProvider } from "./test-provider";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";

/** Включённые провайдеры: PAYMENT_PROVIDERS="test" (через запятую). Пусто — онлайн-оплаты нет, на сайте только оплата при получении. */
export function enabledProviders(env: NodeJS.ProcessEnv = process.env): PaymentProvider[] {
  const ids = (env.PAYMENT_PROVIDERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const out: PaymentProvider[] = [];
  for (const id of ids) {
    if (id === "test") {
      const secret = env.PAYMENT_WEBHOOK_SECRET;
      if (!secret || secret.length < 16) { console.error("[PAYMENTS] test: нужен PAYMENT_WEBHOOK_SECRET (минимум 16 символов), провайдер отключён"); continue; }
      out.push(createTestProvider(secret));
    }
    // Здесь подключаются Payme / Click / Uzum: нужны данные мерчанта от платёжной системы.
  }
  return out;
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
