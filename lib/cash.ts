/** Наличные в кассе: сколько должно лежать по системе. Чистая арифметика, без базы. */
export type CashParts = { opening: number; cashSales: number; cashTips: number; cashRefunds: number; cashIn: number; cashOut: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function expectedCash(p: CashParts): number {
  // наличные чаевые лежат в кассе, пока их не выдали официанту; внесение и изъятие двигают кассу так же, как продажи
  return r2(p.opening + p.cashSales + p.cashTips - p.cashRefunds + p.cashIn - p.cashOut);
}

/** Можно ли изъять сумму: нельзя вынуть больше, чем лежит в кассе по системе */
export function canWithdraw(expected: number, amount: number): boolean {
  return amount > 0 && amount <= expected + 0.005;
}

export const CASH_REASONS = ["Размен", "Инкассация", "Оплата поставщику", "Закупка на точку", "Выдача чаевых", "Другое"];
