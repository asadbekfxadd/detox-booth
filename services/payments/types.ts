/**
 * Слой онлайн-оплаты. Конкретный платёжный сервис (Payme, Click, Uzum и др.) подключается как PaymentProvider:
 * достаточно реализовать createCheckout и verifyWebhook и добавить провайдера в реестр (services/payments/index.ts).
 * Остальной код (заказ, статусы, склад, баллы) от провайдера не зависит.
 */
export type CheckoutInput = { orderId: string; orderNumber: number; amount: number; returnUrl: string };
export type CheckoutResult = { externalId: string; redirectUrl: string };
export type WebhookEvent = { externalId: string; status: "PAID" | "FAILED"; amount?: number };

export interface PaymentProvider {
  /** Короткий код: попадает в URL вебхука и в Payment.provider */
  readonly id: string;
  readonly label: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Проверяет подпись и разбирает тело. null — подпись неверна или тело не распознано. */
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent | null;
}
