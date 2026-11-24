import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { tgCall } from "@/lib/telegram";
import { parseArrival, type ArrivalLine, type IngUnit } from "@/lib/arrival-parse";
import * as UI from "@/lib/bot-purchase-ui";
import { arrivalLocation, commitArrival, staffFor, type StaffActor } from "@/services/bot-sales";
import * as M from "@/lib/bot-sales-messages";

/**
 * Закуп кнопками: «закуп» в личке или в рабочей группе → бот присылает список ингредиентов → нажимаем на ингредиент →
 * бот спрашивает «сколько и по чём?» → отвечаем на его вопрос → «Записать» принимает всё на склад одним приходом.
 * Корзина лежит в BotDraft и привязана к сообщению со списком.
 */
type Item = { ingredientId: string; quantity: number; unitCost: number };
type Msg = { message_id?: number; chat: { id: number }; from?: { id: number }; text?: string; reply_to_message?: { message_id?: number } };
export type TgCallback = { id: string; from: { id: number }; data?: string; message?: { message_id: number; chat: { id: number } } };

const TTL_MS = 2 * 24 * 3600 * 1000;
const html = { parse_mode: "HTML", link_preview_options: { is_disabled: true } };
const asItems = (v: unknown): Item[] => (Array.isArray(v) ? (v as Item[]) : []);

async function ingredientList() {
  return (await prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, avgCost: true } }))
    .map((i) => ({ id: i.id, name: i.name, unit: i.unit as IngUnit, avgCost: Number(i.avgCost) }));
}

async function render(draft: { chatId: string; messageId: number; locationId: string; items: unknown; page: number }) {
  const [ings, loc] = await Promise.all([ingredientList(), prisma.location.findUnique({ where: { id: draft.locationId }, select: { name: true } })]);
  const items = asItems(draft.items);
  const by = new Map(ings.map((i) => [i.id, i]));
  const lines: UI.BasketLine[] = items.flatMap((x) => { const i = by.get(x.ingredientId); return i ? [{ name: i.name, unit: i.unit, quantity: x.quantity, unitCost: x.unitCost }] : []; });
  return {
    text: UI.pickerText(loc?.name ?? "—", lines),
    reply_markup: UI.pickerKeyboard(ings, new Set(items.map((x) => x.ingredientId)), draft.page, lines.length, UI.basketTotal(lines)),
  };
}

async function redraw(draft: Parameters<typeof render>[0]) {
  const v = await render(draft);
  await tgCall("editMessageText", { chat_id: draft.chatId, message_id: draft.messageId, text: v.text, reply_markup: v.reply_markup, ...html });
}

const say = (chatId: string | number, text: string, extra: Record<string, unknown> = {}) => tgCall<{ message_id: number }>("sendMessage", { chat_id: chatId, text, ...html, ...extra });

/** Сообщение сотрудника: «закуп» открывает список, ответ на вопрос бота кладёт позицию в корзину. true, если сообщение наше. */
export async function handlePurchaseMessage(user: StaffActor, m: Msg): Promise<boolean> {
  if (!can(user.role, "purchases.manage") || !m.text) return false;
  const chatId = String(m.chat.id);

  const replyTo = m.reply_to_message?.message_id;
  if (replyTo) {
    const draft = await prisma.botDraft.findFirst({ where: { chatId, promptMessageId: replyTo, userId: user.id, pendingIngredientId: { not: null } } });
    if (!draft || !draft.pendingIngredientId) return false;
    const ing = (await ingredientList()).find((i) => i.id === draft.pendingIngredientId);
    if (!ing) return false;
    const asReply = { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } };
    const text = m.text.trim();
    let items = asItems(draft.items).filter((x) => x.ingredientId !== ing.id);
    if (/^(0|убрать|удалить)$/i.test(text)) {
      // позиция убрана
    } else {
      const numbers = text.match(/\d[\d.,]*/g) ?? [];
      const p = numbers.length >= 2 ? parseArrival(`товар ${text}`, [{ ...ing, name: "товар" }]) : null;
      const line = p && !p.errors.length && p.lines.length === 1 ? p.lines[0] : null;
      if (!line) { await say(chatId, UI.promptBad(ing.name), asReply); return true; }
      items = [...items, { ingredientId: ing.id, quantity: line.quantity, unitCost: line.unitCost }];
    }
    const next = await prisma.botDraft.update({ where: { id: draft.id }, data: { items, pendingIngredientId: null, promptMessageId: null } });
    await redraw(next);
    return true;
  }

  const cmd = UI.pickerCommand(m.text);
  if (!cmd) return false;
  const loc = await arrivalLocation(user, cmd.locationNo);
  if ("ask" in loc) { await say(chatId, loc.ask); return true; }
  const draftBase = { chatId, locationId: loc.id, items: [] as Item[], page: 0 };
  const v = await render({ ...draftBase, messageId: 0 });
  const sent = await say(chatId, v.text, { reply_markup: v.reply_markup });
  if (!sent.ok) return true;
  await prisma.botDraft.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - TTL_MS) } } });
  await prisma.botDraft.create({ data: { ...draftBase, messageId: sent.result.message_id, userId: user.id } });
  return true;
}

/** Нажатие кнопки под списком */
export async function handlePurchaseCallback(cb: TgCallback): Promise<void> {
  const answer = (text?: string) => tgCall("answerCallbackQuery", { callback_query_id: cb.id, ...(text ? { text, show_alert: false } : {}) });
  const data = cb.data ?? "";
  if (!data.startsWith("ap:") || !cb.message) { await answer(); return; }
  const user = await staffFor(String(cb.from.id));
  if (!user || !can(user.role, "purchases.manage")) { await answer(M.arrivalDenied); return; }
  const chatId = String(cb.message.chat.id);
  const draft = await prisma.botDraft.findUnique({ where: { chatId_messageId: { chatId, messageId: cb.message.message_id } } });
  if (!draft || Date.now() - draft.createdAt.getTime() > TTL_MS) { await answer(UI.draftGone); return; }
  if (draft.userId !== user.id) { await answer(UI.draftForeign); return; }

  if (data.startsWith(UI.CB.pick)) {
    const ing = (await ingredientList()).find((i) => i.id === data.slice(UI.CB.pick.length));
    if (!ing) { await answer(); return; }
    const sent = await say(chatId, UI.promptText(ing.name, ing.unit), { reply_to_message_id: draft.messageId, reply_markup: { force_reply: true, selective: true, input_field_placeholder: "50 кг 6000" } });
    if (sent.ok) await prisma.botDraft.update({ where: { id: draft.id }, data: { pendingIngredientId: ing.id, promptMessageId: sent.result.message_id } });
    await answer();
    return;
  }
  if (data.startsWith(UI.CB.page)) {
    const next = await prisma.botDraft.update({ where: { id: draft.id }, data: { page: Math.max(0, Number(data.slice(UI.CB.page.length)) || 0) } });
    await redraw(next);
    await answer();
    return;
  }
  if (data === UI.CB.cancel) {
    await prisma.botDraft.delete({ where: { id: draft.id } });
    await tgCall("editMessageText", { chat_id: chatId, message_id: draft.messageId, text: UI.cancelled, reply_markup: { inline_keyboard: [] }, ...html });
    await answer();
    return;
  }
  if (data === UI.CB.ok) {
    const items = asItems(draft.items);
    if (!items.length) { await answer(UI.emptyBasket); return; }
    // сначала забираем корзину: повторное нажатие «Записать» не создаст второй приход
    const taken = await prisma.botDraft.deleteMany({ where: { id: draft.id } });
    if (taken.count === 0) { await answer(UI.draftGone); return; }
    const ings = new Map((await ingredientList()).map((i) => [i.id, i]));
    const lines: ArrivalLine[] = items.flatMap((x) => {
      const i = ings.get(x.ingredientId);
      return i ? [{ ingredientId: i.id, name: i.name, unit: i.unit, quantity: x.quantity, unitCost: x.unitCost, total: Math.round(x.quantity * x.unitCost), guessedPrice: false }] : [];
    });
    const loc = await prisma.location.findUnique({ where: { id: draft.locationId }, select: { id: true, name: true } });
    const text = loc && lines.length ? await commitArrival(user, loc, lines) : "❌ Не получилось записать приход: точка или ингредиенты не найдены.\nНичего не записано.";
    await tgCall("editMessageText", { chat_id: chatId, message_id: draft.messageId, text, reply_markup: { inline_keyboard: [] }, ...html });
    await answer();
    return;
  }
  await answer();
}
