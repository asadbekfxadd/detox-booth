const nf = new Intl.NumberFormat("ru-RU");
const qf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
export const money = (n: number) => `${nf.format(Math.round(n))} UZS`;
export const num = (n: number) => nf.format(Math.round(n));
export const qty = (n: number) => qf.format(n);
export const pct = (n: number) => `${n.toFixed(1)}%`;
const UNITS: Record<string, string> = { G: "г", KG: "кг", ML: "мл", L: "л", PC: "шт" };
export const unitLabel = (u: string) => UNITS[u] ?? u;
export const dateStr = (d: Date | string) => new Date(d).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" });
export const dateTimeStr = (d: Date | string) => new Date(d).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" });
/** Цена для клиентов: «32 000 сум». В админке остаётся money() с UZS. */
export const sum = (n: number) => `${nf.format(Math.round(n))} сум`;
