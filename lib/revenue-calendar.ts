/** Чистая логика календаря выручки: месяц, сетка, подписи. Все даты по Ташкенту, формат YYYY-MM-DD. */
export const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
export const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) && Number(s.slice(0, 4)) >= 2000;
export function isDay(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && Number(s.slice(0, 4)) >= 2000;
}

export const daysInMonth = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
export const monthFirst = (ym: string) => `${ym}-01`;
export const monthLast = (ym: string) => `${ym}-${String(daysInMonth(ym)).padStart(2, "0")}`;

export function shiftMonth(ym: string, delta: number): string {
  const t = Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Недели месяца, понедельник первый; пустые клетки — null */
export function monthGrid(ym: string): (string | null)[][] {
  const lead = (new Date(`${monthFirst(ym)}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** Границы дня по Ташкенту (UTC+5) как моменты времени */
export const dayStart = (day: string) => new Date(`${day}T00:00:00+05:00`);
export const dayEnd = (day: string) => new Date(dayStart(day).getTime() + 86400000);

/** «15 октября 2026, четверг» */
export function dayTitle(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const wd = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"][d.getUTCDay()];
  return `${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${wd}`;
}

/** Короткая сумма для клетки календаря: 1 250 000 → «1,25 млн», 85 000 → «85 тыс» */
export function shortMoney(n: number): string {
  const a = Math.abs(n);
  const f = (v: number, d: number) => { const t = v.toFixed(d); return (t.includes(".") ? t.replace(/\.?0+$/, "") : t).replace(".", ","); };
  if (a >= 1_000_000) return `${f(n / 1_000_000, 2)} млн`;
  if (a >= 1_000) return `${f(n / 1_000, 0)} тыс`;
  return String(Math.round(n));
}
