export const ACTIVE = ["NEW", "CONFIRMED", "PREPARING", "READY"] as const;
export const STATUS_LABEL: Record<string, string> = { NEW: "Новый", CONFIRMED: "Подтверждён", PREPARING: "Готовится", READY: "Готов к выдаче", COMPLETED: "Завершён", CANCELLED: "Отменён" };
export const STATUS_CLS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800", CONFIRMED: "bg-indigo-100 text-indigo-800", PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-lime-100 text-green-900", COMPLETED: "bg-neutral-100 text-neutral-700", CANCELLED: "bg-red-100 text-red-700",
};
/** Следующий шаг и подпись кнопки. */
export const NEXT: Record<string, { to: string; label: string } | undefined> = {
  NEW: { to: "CONFIRMED", label: "Подтвердить заказ" },
  CONFIRMED: { to: "PREPARING", label: "Начать готовить" },
  PREPARING: { to: "READY", label: "Готов к выдаче" },
  READY: { to: "COMPLETED", label: "Выдан клиенту" },
};
export const SOURCE_LABEL: Record<string, string> = { WEB: "Сайт", POS: "Касса" };
export const FULFILL_LABEL: Record<string, string> = { PICKUP: "Самовывоз", DELIVERY: "Доставка" };
export const METHOD_LABEL: Record<string, string> = { CASH: "Наличные", CARD: "Карта", ONLINE: "Онлайн" };
export const PAY_LABEL: Record<string, string> = { PENDING: "Ожидает оплаты", PAID: "Оплачен", FAILED: "Не оплачен", REFUNDED: "Возврат" };
export const PAY_CLS: Record<string, string> = { PENDING: "bg-amber-100 text-amber-800", PAID: "bg-lime-100 text-green-900", FAILED: "bg-neutral-100 text-neutral-600", REFUNDED: "bg-red-100 text-red-700" };
