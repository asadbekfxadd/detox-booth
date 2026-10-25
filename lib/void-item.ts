/**
 * Отмена позиции в заказе стола. Чистая арифметика и правило согласования, без базы.
 * Пока заказ ждёт отправки на кухню (onHold), его позиции может убрать любой сотрудник.
 * Как только заказ ушёл на кухню, отмену подтверждает менеджер: продукты уже могли быть списаны или приготовлены.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

export const sentToKitchen = (o: { status: string; onHold: boolean }) => !(o.status === "NEW" && o.onHold);

export function needsManagerApproval(o: { status: string; onHold: boolean }, canCancel: boolean): boolean {
  return sentToKitchen(o) && !canCancel;
}

export type VoidResult =
  | { ok: true; removedQty: number; removedSum: number; leftQty: number; orderEmpty: boolean; newSubtotal: number; newTotal: number }
  | { ok: false; error: string };

export function applyVoid(
  order: { subtotal: number; total: number; items: { id: string; quantity: number; unitPrice: number }[] },
  itemId: string, qty: number,
): VoidResult {
  const it = order.items.find((i) => i.id === itemId);
  if (!it) return { ok: false, error: "Позиции уже нет в заказе, обновите страницу" };
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: "Укажите, сколько порций отменить" };
  if (qty > it.quantity) return { ok: false, error: `В заказе только ${it.quantity} шт.` };
  const removedSum = r2(it.unitPrice * qty);
  const leftQty = it.quantity - qty;
  const othersLeft = order.items.some((i) => i.id !== itemId);
  return {
    ok: true, removedQty: qty, removedSum, leftQty, orderEmpty: leftQty === 0 && !othersLeft,
    newSubtotal: Math.max(0, r2(order.subtotal - removedSum)), newTotal: Math.max(0, r2(order.total - removedSum)),
  };
}

export const VOID_REASONS = ["Гость отказался", "Ошибка при вводе", "Долго ждали", "Не тот заказ", "Брак или не понравилось"];
