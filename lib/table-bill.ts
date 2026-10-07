/** Чистая логика счёта стола: без БД, чтобы её можно было проверить тестами. */

export type BillOrderLike = { number: number; status: string; total: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Заказы, которые ещё готовятся: пока они в работе, счёт закрывать нельзя. */
export const IN_WORK = ["NEW", "CONFIRMED", "PREPARING"] as const;

/** Итог счёта: отменённые заказы в сумму не входят. */
export const billTotal = (orders: BillOrderLike[]) => r2(orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + o.total, 0));

/** Номера заказов, из-за которых счёт пока закрыть нельзя (ещё в работе). */
export const closeBlockers = (orders: BillOrderLike[]) => orders.filter((o) => (IN_WORK as readonly string[]).includes(o.status)).map((o) => o.number);

/** Как гость видит статус своего заказа за столом. */
export const GUEST_STATUS: Record<string, string> = {
  NEW: "Отправлен на кухню", CONFIRMED: "Принят", PREPARING: "Готовится", READY: "Готов, скоро принесём", COMPLETED: "Подан", CANCELLED: "Отменён",
};

/** Подпись гостя в комментарии к заказу, чтобы кухня и официант видели, кто заказал. */
export function tableNote(name: string | undefined, note: string | undefined) {
  const parts = [name?.trim() ? `Гость: ${name.trim()}` : "", note?.trim() ?? ""].filter(Boolean);
  return parts.length ? parts.join(". ").slice(0, 300) : null;
}
