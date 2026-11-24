import { dayLabel } from "@/lib/report-day";

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type PlaceDay = { name: string; orders: number; items: number; total: number; cash: number; card: number; online: number; refunds: number };
export type DayReport = { day: string; brand: string; places: PlaceDay[]; closed: { place: string; cashier: string }[]; partial?: boolean };

const sum = (ps: PlaceDay[]): PlaceDay => ps.reduce((a, p) => ({ name: "Итого", orders: a.orders + p.orders, items: a.items + p.items, total: a.total + p.total, cash: a.cash + p.cash, card: a.card + p.card, online: a.online + p.online, refunds: a.refunds + p.refunds }),
  { name: "Итого", orders: 0, items: 0, total: 0, cash: 0, card: 0, online: 0, refunds: 0 });

/** Безналичные = карта + онлайн. Наличные + безнал всегда равны сумме. */
export const noncash = (p: Pick<PlaceDay, "card" | "online">) => p.card + p.online;

function block(p: PlaceDay, title: string | null): string {
  const lines = [
    ...(title ? [`<b>${esc(title)}</b>`] : []),
    `🍹 Продано: <b>${p.items} шт.</b> (заказов: ${p.orders})`,
    `💰 Сумма: <b>${fmt(p.total)}</b>`,
    `💵 Наличные: ${fmt(p.cash)}`,
    `💳 Безнал: ${fmt(noncash(p))}${p.online > 0 && p.card > 0 ? ` (карта ${fmt(p.card)}, онлайн ${fmt(p.online)})` : ""}`,
    ...(p.refunds > 0 ? [`↩️ Возвраты: ${fmt(p.refunds)}`] : []),
  ];
  return lines.join("\n");
}

/** Текст отчёта за день. Сумма в UZS. */
export function dailyReportText(r: DayReport): string {
  const head = `📊 <b>${esc(r.brand)}: итоги за ${dayLabel(r.day)}</b>${r.partial ? " (на сейчас)" : ""}`;
  const active = r.places.filter((p) => p.orders > 0 || p.refunds > 0);
  if (active.length === 0) return `${head}\n\nПродаж не было.${closedText(r)}`;
  const body = active.length === 1 ? block(active[0], active[0].name) : [...active.map((p) => block(p, p.name)), block(sum(active), "Все точки")].join("\n\n");
  return `${head}\n\n${body}${closedText(r)}`;
}

function closedText(r: DayReport): string {
  if (!r.closed.length) return "";
  const who = r.closed.map((c) => `${esc(c.place)} — ${esc(c.cashier)}`).join(", ");
  return `\n\n🔒 Касса закрыта автоматически (${r.closed.length}): ${who}. Наличные в кассе записаны по системе, пересчитайте их утром.`;
}

export const reportOn = "✅ Отчёт будет приходить сюда каждый день в 00:00 (Ташкент).";
export const reportOff = "🔕 Отчёт сюда больше не приходит.";
export const reportDenied = "Отчёты доступны владельцу, администратору и управляющему.";
export const reportHelp = "• «отчёт» — итоги за сегодня на сейчас\n• «отчёт вчера» — за прошлые сутки\n• «отчёт сюда» — присылать итоги в этот чат каждый день в 00:00\n• «отчёт стоп» — не присылать";
