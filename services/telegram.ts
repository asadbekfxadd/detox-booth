import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api";
import { siteUrl } from "@/lib/site-url";
import { getBrand } from "@/services/brand";
import { normalizePhone, type Actor } from "@/services/pos";
import { botToken, telegramConfigured, tgCall, verifyInitData, webhookSecret, type TgUser } from "@/lib/telegram";
import { greeting, helpText, kindForStatus, locationsMessage, orderMessage, ordersMessage, thanksPhone, unknownText, type OrderKind } from "@/lib/telegram-messages";

// ───────────── Mini App: кто открыл приложение ─────────────

/** Пользователь Telegram по initData из Mini App. Без токена бота или с неверной подписью — null. */
export function tgIdentity(initData: unknown): TgUser | null {
  if (typeof initData !== "string" || !telegramConfigured()) return null;
  return verifyInitData(initData, botToken());
}

async function saveUser(u: { id: string; firstName: string; lastName?: string | null; username?: string | null; languageCode?: string | null }, blocked?: boolean) {
  await prisma.telegramUser.upsert({
    where: { id: u.id },
    create: { id: u.id, firstName: u.firstName, lastName: u.lastName ?? null, username: u.username ?? null, languageCode: u.languageCode ?? null },
    update: { firstName: u.firstName, lastName: u.lastName ?? null, username: u.username ?? null, languageCode: u.languageCode ?? null, ...(blocked === undefined ? {} : { blocked }) },
  });
}

/** Имя и телефон для формы заказа: подтверждённый Telegram номер, иначе данные прошлого заказа этого пользователя. */
export async function tgPrefill(initData: unknown): Promise<{ name: string; phone: string } | null> {
  const u = tgIdentity(initData);
  if (!u) return null;
  await saveUser(u).catch(() => undefined);
  const [row, last] = await Promise.all([
    prisma.telegramUser.findUnique({ where: { id: u.id }, select: { phone: true } }),
    prisma.order.findFirst({ where: { telegramId: u.id, customerId: { not: null } }, orderBy: { createdAt: "desc" }, select: { customer: { select: { name: true, phone: true } } } }),
  ]);
  return { name: last?.customer?.name ?? [u.firstName, u.lastName].filter(Boolean).join(" "), phone: row?.phone ?? last?.customer?.phone ?? "" };
}

// ───────────── Бот: отправка и обработка сообщений ─────────────

const openApp = (path: string, text: string) => ({ text, web_app: { url: `${siteUrl()}${path}` } });

async function send(chatId: string, text: string, extra: Record<string, unknown> = {}) {
  const r = await tgCall("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...extra });
  // пользователь заблокировал бота: больше не пишем ему
  if (!r.ok && (r.code === 403 || /blocked|deactivated|chat not found/i.test(r.description))) await prisma.telegramUser.updateMany({ where: { id: chatId }, data: { blocked: true } }).catch(() => undefined);
  return r;
}

const replyKeyboard = (hasPhone: boolean) => ({
  reply_markup: {
    resize_keyboard: true, is_persistent: true,
    keyboard: [
      [openApp("/menu", "🍹 Меню"), { text: "📦 Мои заказы" }],
      hasPhone ? [{ text: "📍 Точки" }] : [{ text: "📍 Точки" }, { text: "📱 Поделиться номером", request_contact: true }],
    ],
  },
});
const menuButton = { reply_markup: { inline_keyboard: [[openApp("/menu", "Открыть меню")]] } };

type TgMessage = {
  chat: { id: number; type: string }; from?: { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string; language_code?: string };
  text?: string; contact?: { phone_number: string; user_id?: number };
};
export type TgUpdate = { message?: TgMessage; my_chat_member?: { chat: { id: number; type: string }; new_chat_member?: { status?: string } } };

async function ordersFor(telegramId: string) {
  const rows = await prisma.order.findMany({ where: { telegramId }, orderBy: { createdAt: "desc" }, take: 5, include: { items: { include: { product: { select: { name: true } } } } } });
  return rows;
}

/** Один входящий апдейт от Telegram. Ошибки наружу не пробрасываем: вебхук всегда отвечает 200, иначе Telegram будет слать апдейт повторно. */
export async function handleUpdate(update: TgUpdate): Promise<void> {
  const my = update.my_chat_member;
  if (my && my.chat.type === "private") {
    const gone = my.new_chat_member?.status === "kicked";
    await prisma.telegramUser.updateMany({ where: { id: String(my.chat.id) }, data: { blocked: gone } });
    return;
  }
  const m = update.message;
  if (!m?.from || m.from.is_bot || m.chat.type !== "private") return;
  const chatId = String(m.chat.id);
  const me = { id: String(m.from.id), firstName: m.from.first_name || "Гость", lastName: m.from.last_name, username: m.from.username, languageCode: m.from.language_code };
  await saveUser(me, false); // пишет боту, значит не заблокировал

  if (m.contact) {
    // принимаем только свой номер: Telegram сверяет user_id, чужой контакт можно переслать вручную
    const phone = m.contact.user_id === m.from.id ? normalizePhone(m.contact.phone_number.startsWith("+") ? m.contact.phone_number : `+${m.contact.phone_number}`) : null;
    if (!phone) { await send(chatId, "Нужен именно ваш номер: нажмите кнопку «Поделиться номером»."); return; }
    await prisma.telegramUser.update({ where: { id: me.id }, data: { phone } });
    await send(chatId, thanksPhone, replyKeyboard(true));
    return;
  }

  const text = (m.text ?? "").trim();
  const cmd = text.startsWith("/") ? text.slice(1).split(/[\s@]/)[0].toLowerCase() : text.replace(/^[^\p{L}]+/u, "").toLowerCase();
  const hasPhone = !!(await prisma.telegramUser.findUnique({ where: { id: me.id }, select: { phone: true } }))?.phone;

  if (cmd === "start") { await send(chatId, greeting((await getBrand()).name, me.firstName), replyKeyboard(hasPhone)); await send(chatId, "Меню и заказ в один клик:", menuButton); return; }
  if (cmd === "menu") { await send(chatId, "Всё меню здесь:", menuButton); return; }
  if (cmd === "orders" || cmd === "мои заказы") {
    const rows = await ordersFor(me.id);
    await send(chatId, ordersMessage(rows.map((o) => ({ number: o.number, status: o.status, total: Number(o.total), at: o.createdAt, summary: o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ") }))),
      rows.length ? { reply_markup: { inline_keyboard: rows.map((o) => [openApp(`/order/${o.id}`, `Заказ №${o.number}`)]) } } : menuButton);
    return;
  }
  if (cmd === "locations" || cmd === "точки") {
    const list = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true, address: true, phone: true } });
    await send(chatId, locationsMessage(list), menuButton);
    return;
  }
  if (cmd === "help") { await send(chatId, helpText, replyKeyboard(hasPhone)); return; }
  await send(chatId, unknownText, menuButton);
}

// ───────────── Уведомления клиенту ─────────────

/** Сообщение клиенту о заказе. Ничего не бросает: статус заказа важнее, чем доставка уведомления. */
export async function notifyOrder(orderId: string, kind: OrderKind): Promise<void> {
  try {
    if (!telegramConfigured()) return;
    const o = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, fulfillment: true, total: true, pointsEarned: true, telegramId: true, location: { select: { name: true } } } });
    if (!o?.telegramId) return;
    const u = await prisma.telegramUser.findUnique({ where: { id: o.telegramId }, select: { blocked: true } });
    if (u?.blocked) return;
    await send(o.telegramId, orderMessage(kind, { number: o.number, fulfillment: o.fulfillment, total: Number(o.total), pointsEarned: o.pointsEarned, location: o.location.name }),
      { reply_markup: { inline_keyboard: [[openApp(`/order/${o.id}`, "Открыть заказ")]] } });
  } catch (e) { console.error("[TELEGRAM NOTIFY]", e); }
}

/** Уведомление по смене статуса: только для важных статусов, без ожидания ответа Telegram */
export function notifyStatus(orderId: string, status: string): void {
  const k = kindForStatus(status);
  if (k) void notifyOrder(orderId, k);
}

// ───────────── Подключение бота из админки ─────────────

export type BotStatus =
  | { configured: false }
  | { configured: true; ok: false; error: string }
  | { configured: true; ok: true; username: string | null; name: string; webhookUrl: string; connected: boolean; pending: number; lastError: string | null; https: boolean };

export async function botStatus(): Promise<BotStatus> {
  if (!telegramConfigured()) return { configured: false };
  const me = await tgCall<{ username?: string; first_name: string }>("getMe");
  if (!me.ok) return { configured: true, ok: false, error: me.description };
  const wh = await tgCall<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo");
  const expected = `${siteUrl()}/api/telegram/webhook`;
  const url = wh.ok ? wh.result.url : "";
  return {
    configured: true, ok: true, username: me.result.username ?? null, name: me.result.first_name, webhookUrl: expected,
    connected: url === expected, pending: wh.ok ? wh.result.pending_update_count : 0, lastError: wh.ok ? wh.result.last_error_message ?? null : null, https: siteUrl().startsWith("https://"),
  };
}

const COMMANDS = [
  { command: "menu", description: "Открыть меню и заказать" }, { command: "orders", description: "Мои заказы" },
  { command: "locations", description: "Адреса точек" }, { command: "help", description: "Что умеет бот" },
];

/** Настроить бота: вебхук, команды, кнопка «Меню» (открывает сайт как Mini App), описание. */
export async function connectBot(user: Actor) {
  if (!telegramConfigured()) throw new ApiError(400, "Сначала добавьте токен бота в переменную TELEGRAM_BOT_TOKEN (Railway → Variables) и дождитесь перезапуска.");
  if (!siteUrl().startsWith("https://")) throw new ApiError(400, "Telegram работает только с https-адресом. Задайте SITE_URL с https:// (на Railway это домен сервиса).");
  const brand = await getBrand();
  const steps: [string, Record<string, unknown>][] = [
    ["setWebhook", { url: `${siteUrl()}/api/telegram/webhook`, secret_token: webhookSecret(), allowed_updates: ["message", "my_chat_member"], max_connections: 20 }],
    ["setMyCommands", { commands: COMMANDS }],
    ["setChatMenuButton", { menu_button: { type: "web_app", text: "Меню", web_app: { url: `${siteUrl()}/` } } }],
    ["setMyShortDescription", { short_description: `${brand.name}: меню и заказ в Telegram`.slice(0, 120) }],
    ["setMyDescription", { description: `${brand.name}. Всё меню, свой микс, акции и бронь стола в одном приложении. Нажмите «Меню», чтобы заказать, а о статусе заказа мы напишем сюда.`.slice(0, 500) }],
  ];
  for (const [method, body] of steps) {
    const r = await tgCall(method, body);
    if (!r.ok) throw new ApiError(502, `Telegram отклонил «${method}»: ${r.description}`);
  }
  await audit({ userId: user.id, action: "TELEGRAM_CONNECTED", entity: "Setting", newValue: { url: `${siteUrl()}/api/telegram/webhook` } });
}

export async function disconnectBot(user: Actor) {
  if (!telegramConfigured()) throw new ApiError(400, "Токен бота не задан");
  const r = await tgCall("deleteWebhook", { drop_pending_updates: false });
  if (!r.ok) throw new ApiError(502, `Telegram отклонил запрос: ${r.description}`);
  await tgCall("setChatMenuButton", { menu_button: { type: "default" } });
  await audit({ userId: user.id, action: "TELEGRAM_DISCONNECTED", entity: "Setting" });
}
