import { escapeHtml as e } from "@/lib/telegram";
import type { LineError, Method, SaleLine } from "@/lib/sale-parse";
import { UNIT_RU, type ArrivalError, type ArrivalLine } from "@/lib/arrival-parse";

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
  "<b>Приход товара</b> (владелец, админ, менеджер, кладовщик). Напишите <code>закуп</code>: бот пришлёт список ингредиентов кнопками, нажимаете на нужный, отвечаете «сколько и по чём» (<code>50 кг 6000</code>), в конце «Записать». Или текстом:",
  "<code>приход</code>",
  "<code>морковь 50 кг 6000 сум</code>",
  "<code>имбирь 30.000 сум кг</code> (без числа = 1 кг)",
  "<code>общий: 360000</code> (по желанию: бот сверит сумму и не запишет, если не сходится)",
  "Цена за 1 кг/шт. Если несколько точек, добавьте «точка 1».",
  "",
  "<b>Итоги дня</b> (владелец, админ, менеджер): каждую ночь в 00:00 бот закрывает кассу и присылает, сколько продано, сумму, наличные и безнал. <code>отчёт</code> — на сейчас, <code>отчёт вчера</code>, <code>отчёт сюда</code> (в группе: присылать в этот чат), <code>отчёт стоп</code>.",
  "",
  "Команды: <code>отмена</code> (последняя продажа), <code>итог</code> (смена), <code>закрыть 1250000</code> (закрыть смену, сумма в кассе), <code>точка 1</code> (выбрать точку).",
].join("\n");

// ───────────── Приход ─────────────
const num = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(n);
const arrLine = (l: ArrivalLine) => `${e(l.name)}: ${num(l.quantity)} ${UNIT_RU[l.unit]} × ${num(l.unitCost)} = ${num(l.total)}${l.guessedPrice ? " (цена не указана, взял среднюю)" : ""}`;

export function arrivalDone(o: { location: string; lines: ArrivalLine[]; total: number }): string {
  return [`📦 <b>Приход записан</b> на точку «${e(o.location)}»`, ...o.lines.map(arrLine), `Итого: <b>${sum(o.total)}</b>`, "Склад и средняя цена обновлены. Ошиблись? Исправить можно в админке через «Списания»."].join("\n");
}

export function arrivalFailed(errors: ArrivalError[]): string {
  const why = (x: ArrivalError) =>
    x.reason === "ambiguous" ? `уточните, это ${(x.candidates ?? []).map(e).join(" или ")}?`
    : x.reason === "unit" ? `эта позиция считается в «${(x.candidates ?? []).map(e).join("")}», единица не подходит`
    : x.reason === "unclear" ? "не понял количество и цену. Пишите так: «морковь 50 кг 6000 сум»"
    : "нет такого ингредиента на складе";
  return ["❌ Приход не записан.", ...errors.map((x) => `• «${e(x.raw)}»: ${why(x)}`), "", "Поправьте и отправьте сообщение целиком ещё раз."].join("\n");
}

export const arrivalMismatch = (calc: number, claimed: number, lines: ArrivalLine[]) =>
  ["❌ Приход не записан: сумма не сходится.", ...lines.map(arrLine), `По строкам вышло ${sum(calc)}, а вы написали ${sum(claimed)}.`, "Проверьте количество и цены и отправьте ещё раз."].join("\n");

export const arrivalEmpty = "Не вижу товаров в приходе. Пишите так:\n<code>приход\nморковь 50 кг 6000 сум\nимбирь 2 кг 30000 сум\nобщий: 360000</code>\nЦена за 1 кг (или за штуку); строка «общий» нужна для сверки.";
export const arrivalDenied = "Приход записывают владелец, администратор, менеджер и кладовщик. У вашей роли такого права нет.";
export const arrivalAskLocation = (list: { name: string }[]) => ["На какую точку пришёл товар? Добавьте в сообщение «точка» и номер, например «точка 1»:", ...list.map((l, i) => `${i + 1}. ${e(l.name)}`)].join("\n");
export const noPos = "У вас нет доступа к кассе, продажи через бота записывать нельзя. Приход можно: напишите «приход» и товары.";
