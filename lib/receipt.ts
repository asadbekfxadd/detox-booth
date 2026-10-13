/** Сборка итогов чека: чистая логика без БД. */
import { feeOf } from "@/lib/table-bill";

export type BillOrderForReceipt = { status: string; total: number; serviceFee: number; paid: boolean; tip: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Итоги чека стола. Оплаченные заказы уже содержат свой сбор, для неоплаченных сбор считается по текущему проценту.
 * subtotal — позиции без сбора, total — с учётом сбора, due — сколько ещё осталось оплатить.
 */
export function billReceiptTotals(orders: BillOrderForReceipt[], feePct: number) {
  const live = orders.filter((o) => o.status !== "CANCELLED");
  const paid = live.filter((o) => o.paid);
  const open = live.filter((o) => !o.paid);
  const subtotal = r2(live.reduce((s, o) => s + (o.paid ? o.total - o.serviceFee : o.total), 0));
  const openFee = feeOf(open.reduce((s, o) => s + o.total, 0), feePct);
  const fee = r2(paid.reduce((s, o) => s + o.serviceFee, 0) + openFee);
  const paidSum = r2(paid.reduce((s, o) => s + o.total, 0));
  const total = r2(subtotal + fee);
  return { subtotal, fee, total, paid: paidSum, due: r2(total - paidSum), tip: r2(live.reduce((s, o) => s + o.tip, 0)), closed: open.length === 0 && live.length > 0 };
}
