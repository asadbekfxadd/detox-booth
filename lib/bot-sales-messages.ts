import { escapeHtml as e } from "@/lib/telegram";
import type { LineError, Method, SaleLine } from "@/lib/sale-parse";

/** Тексты бота для сотрудника, который записывает продажи. HTML-разметка Telegram, всё из базы и от людей экранируем. */
const sum = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} сум`;
export const METHOD_RU: Record<Method, string> = { CASH: "наличными", CARD: "картой", ONLINE: "онлайн" };

export const lineText = (l: Pick<SaleLine, "quantity" | "name" | "optionNames">) =>
  `${l.quantity}× ${e(l.name)}${l.optionNames.length ? ` (${l.optionNames.map(e).join(", ")})` : ""}`;

export function saleDone(o: { number: number; total: number; method: Method; lines: SaleLine[]; discount: number }): string {
  return [
    `✅ <b>Продажа №${o.number}</b> записана`,
    ...o.lines.map(lineText),
    `Итого: <b>${sum(o.total)}</b> · ${METHOD_RU[o.method]}${o.discount > 0 ? ` (скидка ${sum(o.discount)})` : ""}`,
    "Ошиблись? Напишите «отмена».",
  ].join("\n");
}

export function saleFailed(errors: LineError[], understood: SaleLine[]): string {
  const why = (x: LineError) =>
    x.reason === "ambiguous" ? `уточните, это ${(x.candidates ?? []).map(e).join(" или ")}?`
    : x.reason === "size" ? `нет такого объёма, есть: ${(x.candidates ?? []).map(e).join(", ")}`
    : "не нашёл такой напиток";
  return [
    "❌ Ничего не записал.",
    ...errors.map((x) => `• «${e(x.raw)}»: ${why(x)}`),
    ...(understood.length ? ["", "Остальное понял:", ...understood.map(lineText)] : []),
    "",
    "Поправьте и отправьте сообщение целиком ещё раз.",
  ].join("\n");
}

export const saleStopped = (reason: string) => `❌ Не получилось записать продажу: ${e(reason)}\nНичего не записано.`;

export const shiftOpened = (location: string) => `Смена на точке «${e(location)}» открыта автоматически (в кассе на старте 0 сум).`;

export function chooseLocation(list: { name: string }[]): string {
  return ["С какой точки продаёте? Напишите «точка» и номер:", ...list.map((l, i) => `${i + 1}. ${e(l.name)}`)].join("\n");
}

export const noSale = "Нечего отменять: за последние сутки через бота продаж не записано.";
export const undone = (number: number, total: number) => `↩️ Продажа №${number} на ${sum(total)} отменена.`;
export const undoDenied = "Эту продажу уже нельзя отменить самому: прошло больше получаса. Верните её в кассе через «Возврат».";

export type DaySummary = {
  location: string; since: Date; count: number; total: number; cash: number; card: number; online: number; refunds: number;
  top: { name: string; qty: number }[];
};
export function summaryText(s: DaySummary): string {
  const t = s.since.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
  return [
    `📊 <b>${e(s.location)}</b>, смена с ${t}`,
    s.count ? `Продаж: ${s.count}, выручка <b>${sum(s.total)}</b>` : "Продаж пока нет.",
    ...(s.count ? [`Наличными ${sum(s.cash)} · картой ${sum(s.card)} · онлайн ${sum(s.online)}`] : []),
    ...(s.refunds ? [`Возвратов: ${s.refunds}`] : []),
    ...(s.top.length ? ["", "Чаще всего:", ...s.top.map((x) => `${e(x.name)}: ${x.qty}`)] : []),
  ].join("\n");
}

export const noShift = "Смена не открыта. Напишите первую продажу, и смена откроется сама.";
export const closeAsk = (expected: number) => `В кассе должно быть <b>${sum(expected)}</b>.\nЧтобы закрыть смену, напишите, сколько денег в кассе на самом деле: «закрыть 1250000».`;
export const closed = (expected: number, counted: number) =>
  `Смена закрыта. В кассе ${sum(counted)}, ожидалось ${sum(expected)}${counted === expected ? ": всё сходится ✅" : `, разница ${counted - expected > 0 ? "+" : "−"}${sum(Math.abs(counted - expected))}`}.`;

export const staffLinked = (name: string) => `Готово, ${e(name)}: бот привязан к вашему аккаунту.\n${staffHelp}`;
export const linkBad = "Ссылка недействительна или устарела. Попросите владельца выдать новую в админке (Сотрудники → ваш профиль).";
export const linkTaken = "Этот Telegram уже привязан к другому сотруднику, либо у сотрудника уже есть привязка. Отвяжите её в админке и выдайте новую ссылку.";

export const staffHelp = [
  "<b>Как записывать продажи</b>",
  "Просто пишите, что продали:",
  "• <code>яблочный сок</code>",
  "• <code>2 латте</code> или <code>латте 2</code>",
  "• <code>апельсиновый фреш 0.5</code> (объём)",
  "• <code>капучино, 3 американо карта</code> (несколько позиций, оплата)",
  "Без слов про оплату пишу наличными; «карта», «онлайн», «click», «payme» меняют способ.",
  "Без объёма беру самый маленький.",
  "",
  "Можно писать и в рабочую группу, где есть бот: ответит там же. Работают продажи, <code>отмена</code> и <code>итог</code>.",
  "",
  "Команды: <code>отмена</code> (последняя продажа), <code>итог</code> (смена), <code>закрыть 1250000</code> (закрыть смену, сумма в кассе), <code>точка 1</code> (выбрать точку).",
].join("\n");
