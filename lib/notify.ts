/**
 * Тексты уведомлений для людей: по-русски, остатки в кг/л/шт.
 * Старые уведомления в базе записаны по-английски («LOW STOCK: Манго — 125 G (min 0)»), их humanizeNotification переписывает при показе.
 */
import { fmtStock } from "@/lib/ingredient-units";

const REASON: Record<string, string> = { EXPIRED: "истёк срок", SPOILED: "испортилось", DAMAGED: "повреждено", PRODUCTION_WASTE: "потери при готовке", EMPLOYEE_ERROR: "ошибка сотрудника", OTHER: "прочее" };
const sign = (n: number) => (n > 0 ? "+" : "");

/** Начало текста «мало на складе»: по нему не создаём второе непрочитанное уведомление про тот же продукт */
export const lowStockPrefix = (name: string) => `Мало на складе: ${name}`;
/** Прежний английский вариант: учитываем при проверке повторов, пока старые уведомления не прочитаны */
export const legacyLowStockPrefix = (name: string) => `LOW STOCK: ${name}`;

export function lowStockMessage(name: string, unit: string, now: number, min: number): string {
  const tail = now < 0 ? ". Остаток ушёл в минус: возможно, не оформлен приход" : "";
  return `${lowStockPrefix(name)} — осталось ${fmtStock(unit, now)}, минимум ${fmtStock(unit, min)}${tail}`;
}
export const largeWriteOffMessage = (name: string, unit: string, qty: number, cost: number, reason: string) =>
  `Крупное списание: ${name}, ${fmtStock(unit, qty)} на ${Math.round(cost).toLocaleString("ru-RU")} UZS (${REASON[reason] ?? reason})`;
export const varianceMessage = (name: string, unit: string, variance: number, cost: number) =>
  `Расхождение при инвентаризации: ${name}, ${sign(variance)}${fmtStock(unit, variance)} (${Math.round(cost).toLocaleString("ru-RU")} UZS)`;

const UNIT = "G|KG|ML|L|PC";
/** Английское уведомление из старой записи → русский текст. Уже русские и незнакомые возвращаются как есть. */
export function humanizeNotification(msg: string): string {
  let m = new RegExp(`^LOW STOCK: (.+?) — (-?[\\d.]+) (${UNIT}) \\(min (-?[\\d.]+)\\)$`).exec(msg);
  if (m) return lowStockMessage(m[1], m[3], Number(m[2]), Number(m[4]));
  m = new RegExp(`^LARGE WRITE-OFF: (.+?) (-?[\\d.]+) (${UNIT}) на (\\d+) UZS \\((\\w+)\\)$`).exec(msg);
  if (m) return largeWriteOffMessage(m[1], m[3], Number(m[2]), Number(m[4]), m[5]);
  m = new RegExp(`^INVENTORY VARIANCE: (.+?) ([+-]?[\\d.]+) (${UNIT}) \\((-?\\d+) UZS\\)$`).exec(msg);
  if (m) return varianceMessage(m[1], m[3], Number(m[2]), Number(m[4]));
  return msg;
}
