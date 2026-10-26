import { escapeHtml } from "@/lib/telegram";

/** Тексты бота. HTML-разметка Telegram: всё, что пришло от людей (имена, названия), экранируем. */
const sum = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} сум`;
const e = escapeHtml;

export type OrderKind = "created" | "CONFIRMED" | "READY" | "ON_THE_WAY" | "COMPLETED" | "CANCELLED";
export type OrderInfo = { number: number; fulfillment: "PICKUP" | "DELIVERY"; total: number; pointsEarned: number; location: string };

export function orderMessage(kind: OrderKind, o: OrderInfo): string {
  const n = `<b>Заказ №${o.number}</b>`;
  const delivery = o.fulfillment === "DELIVERY";
  switch (kind) {
    case "created": return `${n} принят ✅\nСумма: ${sum(o.total)}\n${delivery ? "Доставим по вашему адресу" : `Заберёте на точке: ${e(o.location)}`}. Напишем, когда он будет подтверждён и готов.`;
    case "CONFIRMED": return `${n} подтверждён 👍\nСкоро начнём готовить.`;
    case "READY": return delivery ? `${n} готов 🥤\nСейчас передадим курьеру.` : `${n} готов 🥤\nМожно забирать: ${e(o.location)}.`;
    case "ON_THE_WAY": return `${n}: курьер уже в пути 🛵`;
    case "COMPLETED": return `${n} выдан. Приятного аппетита! 🍹${o.pointsEarned > 0 ? `\nНачислено баллов: ${o.pointsEarned}.` : ""}`;
    case "CANCELLED": return `${n} отменён.\nЕсли это неожиданно, свяжитесь с точкой «${e(o.location)}».`;
  }
}

/** Какое уведомление отправить при смене статуса заказа; для остальных статусов сообщений нет (чтобы не слать лишнего) */
export function kindForStatus(status: string): OrderKind | null {
  return status === "CONFIRMED" || status === "READY" || status === "COMPLETED" || status === "CANCELLED" ? status : null;
}

export const STATUS_RU: Record<string, string> = { NEW: "принят", CONFIRMED: "подтверждён", PREPARING: "готовится", READY: "готов", COMPLETED: "выдан", CANCELLED: "отменён" };

export type OrderBrief = { number: number; status: string; total: number; at: Date; summary: string };

export function ordersMessage(orders: OrderBrief[]): string {
  if (orders.length === 0) return "Заказов пока нет. Откройте меню и выберите что-нибудь вкусное 🍹";
  const day = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit" });
  return ["<b>Ваши последние заказы</b>", ...orders.map((o) => `№${o.number} · ${day(o.at)} · ${STATUS_RU[o.status] ?? o.status} · ${sum(o.total)}\n${e(o.summary)}`)].join("\n\n");
}

export type LocationInfo = { name: string; address: string | null; phone: string | null };
export function locationsMessage(list: LocationInfo[]): string {
  if (list.length === 0) return "Точки пока не добавлены.";
  return ["<b>Наши точки</b>", ...list.map((l) => `📍 <b>${e(l.name)}</b>${l.address ? `\n${e(l.address)}` : ""}${l.phone ? `\n${e(l.phone)}` : ""}`)].join("\n\n");
}

export const greeting = (brand: string, first: string) =>
  `Привет, ${e(first)}! Это <b>${e(brand)}</b> 🍹\nВсё меню, свой микс, акции и бронь стола, как на сайте: нажмите «Открыть меню». Заказ можно оформить прямо здесь, а о его статусе мы напишем в этот чат.`;

export const helpText = "Что умеет бот:\n/menu: открыть меню и заказать\n/orders: ваши последние заказы\n/locations: адреса и телефоны точек\nКнопка «Поделиться номером» ускорит оформление заказа и привяжет баллы к вашему номеру.";
export const thanksPhone = "Спасибо! Номер сохранён: он подставится при оформлении заказа.";
export const unknownText = "Не понял 🙂 Откройте меню кнопкой ниже или выберите команду: /orders, /locations, /help.";
