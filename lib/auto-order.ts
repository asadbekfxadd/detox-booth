/**
 * Автозаказ: что и сколько заказать поставщику. Чистая арифметика без базы.
 *
 * Заказываем, когда (остаток + уже заказанное) ниже точки заказа: это большее из минимального остатка
 * и расхода за срок доставки. Заказываем до уровня: большее из «максимума» ингредиента и расхода за N дней запаса.
 */
export type NeedInput = {
  /** Остаток на точке, в единицах склада (г, мл, шт) */
  stock: number;
  /** Уже заказано и не принято (черновики и оформленные закупки) */
  onOrder: number;
  min: number; max: number;
  /** Средний расход в день за последний месяц */
  avgDaily: number;
  /** На сколько дней хотим запас после поставки */
  coverDays: number;
  /** Сколько дней едет поставка */
  leadDays: number;
  unit: string;
};

export type Suggestion = { qty: number; reason: "below_min" | "runs_out" | null; daysLeft: number | null };

/** Шаг округления заказа вверх: 100 г или мл, целые штуки */
export const orderStep = (unit: string) => (unit === "PC" ? 1 : unit === "G" || unit === "ML" ? 100 : 0.1);
export const roundUpTo = (n: number, step: number) => Math.ceil(n / step - 1e-9) * step;

export function suggestQty(i: NeedInput): Suggestion {
  const have = i.stock + i.onOrder;
  const daysLeft = i.avgDaily > 0 ? Math.max(0, i.stock) / i.avgDaily : null;
  const reorderPoint = Math.max(i.min, i.avgDaily * Math.max(0, i.leadDays));
  if (!(reorderPoint > 0) || !(have < reorderPoint)) return { qty: 0, reason: null, daysLeft };
  const target = Math.max(i.max, i.min, i.avgDaily * Math.max(0, i.coverDays));
  const raw = target - have;
  if (!(raw > 0)) return { qty: 0, reason: null, daysLeft };
  const qty = Math.round(roundUpTo(raw, orderStep(i.unit)) * 1000) / 1000;
  return { qty, reason: have < i.min ? "below_min" : "runs_out", daysLeft };
}

/** Текст заказа, который можно отправить поставщику в мессенджер */
export function orderText(p: { supplier: string; location: string; lines: { name: string; qty: string }[] }): string {
  return [`Здравствуйте! Заказ для точки «${p.location}»:`, ...p.lines.map((l) => `• ${l.name}: ${l.qty}`), "", "Подтвердите, пожалуйста, наличие и время доставки."].join("\n");
}
