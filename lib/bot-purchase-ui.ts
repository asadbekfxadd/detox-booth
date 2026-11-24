import { escapeHtml as e } from "@/lib/telegram";
import { UNIT_RU, type IngUnit } from "@/lib/arrival-parse";

/** Корзина закупа в Telegram: тексты и кнопки. Чистые функции, всё приходит параметрами. */
export const PAGE_SIZE = 18;
const COLS = 3;
export const CB = { pick: "ap:i:", page: "ap:p:", ok: "ap:ok", cancel: "ap:x" } as const;

const money = (n: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} сум`;
const num = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(n);

export type BasketLine = { name: string; unit: IngUnit; quantity: number; unitCost: number };
export const basketTotal = (l: BasketLine[]) => l.reduce((a, x) => a + x.quantity * x.unitCost, 0);

export function pickerText(location: string, lines: BasketLine[]): string {
  return [
    `📦 <b>Закуп</b> на точку «${e(location)}»`,
    "",
    ...(lines.length
      ? ["В корзине:", ...lines.map((l) => `• ${e(l.name)}: ${num(l.quantity)} ${UNIT_RU[l.unit]} × ${num(l.unitCost)} = ${num(l.quantity * l.unitCost)}`), `Итого: <b>${money(basketTotal(lines))}</b>`, ""]
      : ["Корзина пуста."]),
    "Нажмите на ингредиент, бот спросит количество и цену. Когда всё добавили, нажмите «Записать».",
  ].join("\n");
}

export const promptText = (name: string, unit: IngUnit) =>
  `<b>${e(name)}</b>: сколько и по чём? Ответьте на это сообщение, например: <code>50 ${UNIT_RU[unit] === "шт" ? "шт" : UNIT_RU[unit]} 6000</code> (цена за 1 ${UNIT_RU[unit]}). «0» убирает позицию из корзины.`;
export const promptBad = (name: string) => `Не понял. Для «${e(name)}» напишите количество и цену за единицу, например: <code>50 кг 6000</code>`;
export const draftGone = "Этот закуп устарел или уже закрыт. Напишите «закуп» заново.";
export const draftForeign = "Это закуп другого сотрудника.";
export const emptyBasket = "Корзина пуста: нажмите на ингредиент.";
export const cancelled = "Закуп отменён, ничего не записано.";

type Btn = { text: string; callback_data: string };
export function pickerKeyboard(list: { id: string; name: string }[], inBasket: Set<string>, page: number, count: number, total: number): { inline_keyboard: Btn[][] } {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const slice = list.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
  const rows: Btn[][] = [];
  for (let i = 0; i < slice.length; i += COLS)
    rows.push(slice.slice(i, i + COLS).map((x) => ({ text: `${inBasket.has(x.id) ? "✅ " : ""}${x.name}`.slice(0, 28), callback_data: `${CB.pick}${x.id}` })));
  if (pages > 1) rows.push([
    { text: "◀", callback_data: `${CB.page}${Math.max(0, p - 1)}` },
    { text: `${p + 1}/${pages}`, callback_data: `${CB.page}${p}` },
    { text: "▶", callback_data: `${CB.page}${Math.min(pages - 1, p + 1)}` },
  ]);
  rows.push([{ text: count ? `✅ Записать (${count}, ${money(total)})` : "✅ Записать", callback_data: CB.ok }, { text: "✖ Отмена", callback_data: CB.cancel }]);
  return { inline_keyboard: rows };
}

/** «закуп», «приход», «закупка точка 2» без товаров: открыть список. Возвращает номер точки (или null), либо undefined, если это не команда. */
export function pickerCommand(raw: string): { locationNo: number | null } | undefined {
  const t = raw.toLowerCase().replace(/@\w+/g, " ").replace(/ё/g, "е").replace(/^[^\p{L}\d]+/u, "").replace(/[^\p{L}\d]+$/u, "").replace(/\s+/g, " ").trim();
  const m = /^(закуп|закупка|закупки|приход)(?: точка (\d+))?$/.exec(t);
  return m ? { locationNo: m[2] ? Number(m[2]) : null } : undefined;
}
