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

/* ---------- сервисный сбор, чаевые, раздельная оплата ---------- */

/** Ключ настройки: сервисный сбор за столом, % от суммы заказов. 0 — выключен. */
export const SERVICE_FEE_KEY = "table.serviceFeePct";

/** Сбор в целых суммах (UZS без копеек). */
export const feeOf = (amount: number, pct: number) => (pct > 0 && amount > 0 ? Math.round((amount * pct) / 100) : 0);

/** Чаевые в % от суммы к оплате (после сбора), в целых суммах. */
export const tipByPct = (amount: number, pct: number) => (pct > 0 && amount > 0 ? Math.round((amount * pct) / 100) : 0);

/**
 * Делит сумму между заказами пропорционально их весам так, чтобы части в сумме дали ровно total
 * (метод наибольших остатков). Целая сумма делится на целые части, иначе — на копейки.
 */
export function allocate(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const unit = Number.isInteger(total) ? 1 : 0.01;
  const n = Math.round(total / unit);
  const W = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (n <= 0 || W <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (n * Math.max(0, w)) / W);
  const base = raw.map(Math.floor);
  let left = n - base.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) { if (left <= 0) break; base[i]++; left--; }
  return base.map((x) => r2(x * unit));
}

export type PayableOrder = { number: number; status: string; total: number; paid: boolean };

/** Заказы, которые ещё предстоит оплатить: не отменены и не оплачены. */
export const unpaidOrders = <T extends PayableOrder>(orders: T[]) => orders.filter((o) => o.status !== "CANCELLED" && !o.paid);

/** Сумма к оплате и сбор по выбранным заказам; чаевые идут сверх. */
export function payQuote(subtotal: number, feePct: number, tip: number) {
  const fee = feeOf(subtotal, feePct);
  const total = r2(subtotal + fee);
  const t = Math.max(0, r2(tip || 0));
  return { subtotal: r2(subtotal), fee, total, tip: t, collect: r2(total + t) };
}
