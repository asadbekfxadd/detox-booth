/**
 * Брутто и нетто. «Выход» ингредиента, %: сколько годного получается из закупленного.
 * Из 1000 г апельсина выходит 450 мл сока — выход 45. В рецепте пишут нетто (что попало в стакан),
 * со склада списывается брутто (что пришлось взять), себестоимость считается от брутто.
 */
export const MIN_YIELD = 1;
export const MAX_YIELD = 100;

/** Выход в допустимых границах: пусто, ноль, мусор — 100 (потерь нет), чтобы не делить на ноль */
export function normYield(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return MAX_YIELD;
  return Math.min(MAX_YIELD, Math.max(MIN_YIELD, n));
}

/** Сколько взять со склада, чтобы получить net годного */
export const grossQty = (net: number, yieldPct: unknown) => (net * 100) / normYield(yieldPct);

/** Стоимость 1 единицы годного при цене закупки avgCost за единицу брутто */
export const netUnitCost = (avgCost: number, yieldPct: unknown) => (avgCost * 100) / normYield(yieldPct);

/** Потери при обработке, % от закупленного */
export const lossPctOf = (yieldPct: unknown) => Math.round((100 - normYield(yieldPct)) * 100) / 100;
