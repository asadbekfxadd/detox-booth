/**
 * Оборотная ведомость склада: по каждому ингредиенту остаток на начало, движение за период и остаток на конец.
 * Чистая арифметика: на вход текущий остаток и сумма движений, на выход строки отчёта.
 *
 * Считаем от ТЕКУЩЕГО остатка назад: конец периода = остаток сейчас − всё, что двигалось после конца периода;
 * начало = конец − движение за период. Так отчёт сходится с реальным складом, даже если до запуска остатки вносили без журнала.
 */
export type Kind = "PURCHASE" | "TRANSFER_IN" | "PRODUCTION_IN" | "SALE" | "WRITE_OFF" | "PRODUCTION_OUT" | "TRANSFER_OUT" | "COUNT" | "ADJUSTMENT";

/** Что движется за период и после него, по видам движения: количество со знаком (приход +, расход −) */
export type Moves = Partial<Record<Kind, number>>;

export type TurnoverRow = {
  opening: number; receipts: number; prodIn: number; sales: number; writeOffs: number; prodOut: number; transferOut: number; adjust: number; closing: number;
};

const sum = (m: Moves) => Object.values(m).reduce((a, b) => a + (b ?? 0), 0);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function buildRow(current: number, inPeriod: Moves, afterPeriod: Moves): TurnoverRow {
  const closing = current - sum(afterPeriod);
  const opening = closing - sum(inPeriod);
  const g = (k: Kind) => inPeriod[k] ?? 0;
  return {
    opening: r3(opening), closing: r3(closing),
    receipts: r3(g("PURCHASE") + g("TRANSFER_IN")),
    prodIn: r3(g("PRODUCTION_IN")),
    // продажи с учётом возвратов при отмене заказа: показываем как расход (положительное число)
    sales: r3(-g("SALE")),
    writeOffs: r3(-g("WRITE_OFF")),
    prodOut: r3(-g("PRODUCTION_OUT")),
    transferOut: r3(-g("TRANSFER_OUT")),
    adjust: r3(g("COUNT") + g("ADJUSTMENT")),
  };
}

/** Строка без движения и без остатка не нужна в отчёте */
export const isEmptyRow = (r: TurnoverRow) =>
  r.opening === 0 && r.closing === 0 && r.receipts === 0 && r.prodIn === 0 && r.sales === 0 && r.writeOffs === 0 && r.prodOut === 0 && r.transferOut === 0 && r.adjust === 0;

/** Начало и конец суток по Ташкенту (UTC+5): от 00:00 первого дня до 00:00 следующего за последним */
export function periodBounds(from: string, to: string): { from: Date; to: Date } | null {
  const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00+05:00`).getTime());
  if (!ok(from) || !ok(to)) return null;
  const start = new Date(`${from}T00:00:00+05:00`);
  const end = new Date(new Date(`${to}T00:00:00+05:00`).getTime() + 86400000);
  if (end <= start) return null;
  return { from: start, to: end };
}

export const todayTashkent = (now = new Date()) => new Date(now.getTime() + 5 * 3600000).toISOString().slice(0, 10);
export const monthStartTashkent = (now = new Date()) => `${todayTashkent(now).slice(0, 8)}01`;
