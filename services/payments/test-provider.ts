import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { CheckoutInput, CheckoutResult, PaymentProvider, WebhookEvent } from "./types";

/** Подпись тела вебхука: HMAC-SHA256 от «сырой» строки тела, hex. */
export function signBody(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Тестовый провайдер для проверки всей цепочки (оплата → вебхук → статус) без реального платёжного сервиса.
 * Включается только переменной PAYMENT_PROVIDERS=test и требует PAYMENT_WEBHOOK_SECRET.
 */
export function createTestProvider(secret: string): PaymentProvider {
  return {
    id: "test",
    label: "Тестовая оплата",
    async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
      return { externalId: `test_${randomUUID()}`, redirectUrl: input.returnUrl };
    },
    verifyWebhook(rawBody, headers): WebhookEvent | null {
      const sig = headers.get("x-signature");
      if (!sig || !safeEqualHex(sig, signBody(rawBody, secret))) return null;
      try {
        const j = JSON.parse(rawBody) as { externalId?: unknown; status?: unknown; amount?: unknown };
        if (typeof j.externalId !== "string" || (j.status !== "PAID" && j.status !== "FAILED")) return null;
        return { externalId: j.externalId, status: j.status, amount: typeof j.amount === "number" ? j.amount : undefined };
      } catch { return null; }
    },
  };
}
