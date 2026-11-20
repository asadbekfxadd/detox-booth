import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api";
import { can, canSwitchLocation } from "@/lib/rbac";
import { canManage } from "@/services/employees";
import { toMessage } from "@/lib/errors";
import { MIX_PRODUCT_NAME } from "@/lib/mix";
import { parseSale, type MatchProduct } from "@/lib/sale-parse";
import { makeLinkToken, readLinkToken } from "@/lib/tg-link";
import * as M from "@/lib/bot-sales-messages";
import { closeShift, createPosOrder, getOpenShift, openShift, refundOrder, shiftSummary, type Actor } from "@/services/pos";
import { botToken, tgCall } from "@/lib/telegram";

/**
 * Продажи текстом из Telegram. Сотрудник с правом «касса» привязывает свой Telegram по одноразовой ссылке из админки,
 * потом пишет боту «2 латте»: бот сам пробивает продажу в кассе (склад, смена, выручка, как в POS).
 */
export type StaffActor = Actor & { name: string };
const NOTE_PREFIX = "Бот: ";
const UNDO_FREE_MS = 30 * 60 * 1000;
const UNDO_WINDOW_MS = 24 * 3600 * 1000;

/** Сотрудник по Telegram: активный и с доступом к кассе, иначе null (обычный покупатель) */
export async function staffFor(telegramId: string): Promise<StaffActor | null> {
  const u = await prisma.user.findFirst({ where: { telegramId, isActive: true }, select: { id: true, name: true, role: true, locationId: true } });
  return u && can(u.role, "pos.use") ? u : null;
}

// ───────────── Привязка ─────────────

/** Ссылка для привязки: из админки выдаёт владелец/администратор. Бот должен быть подключён (нужен его @username). */
export async function issueLink(actor: Actor, userId: string): Promise<string> {
  if (!botToken()) throw new ApiError(400, "Сначала подключите Telegram-бота (Telegram-бот в меню админки).");
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true, telegramId: true } });
  if (!u || !u.isActive) throw new ApiError(404, "Сотрудник не найден");
  if (!canManage(actor.role, u.role)) throw new ApiError(403, "Недостаточно прав для изменения этого сотрудника");
  if (!can(u.role, "pos.use")) throw new ApiError(400, "У этой роли нет доступа к кассе: записывать продажи ей нельзя.");
  if (u.telegramId) throw new ApiError(400, "Telegram уже привязан. Сначала отвяжите его.");
  const me = await tgCall<{ username?: string }>("getMe");
  if (!me.ok || !me.result.username) throw new ApiError(502, "Telegram не ответил: не удалось узнать имя бота. Проверьте токен на странице «Telegram-бот».");
  return `https://t.me/${me.result.username}?start=link_${makeLinkToken(userId)}`;
}

export async function unlinkStaff(actor: Actor, userId: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, telegramId: true } });
  if (!u) throw new ApiError(404, "Сотрудник не найден");
  if (!canManage(actor.role, u.role)) throw new ApiError(403, "Недостаточно прав для изменения этого сотрудника");
  await prisma.user.update({ where: { id: userId }, data: { telegramId: null } });
  await audit({ userId: actor.id, action: "STAFF_TELEGRAM_UNLINKED", entity: "User", entityId: userId });
}

/** Сотрудник открыл ссылку из админки: токен проверяем, привязываем только если у сотрудника и у этого Telegram привязки ещё нет */
export async function linkStaff(token: string, telegramId: string): Promise<string> {
  const userId = readLinkToken(token);
  if (!userId) return M.linkBad;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, isActive: true, telegramId: true } });
  if (!u || !u.isActive || !can(u.role, "pos.use")) return M.linkBad;
  if (u.telegramId) return M.linkTaken;
  try {
    const r = await prisma.user.updateMany({ where: { id: u.id, telegramId: null }, data: { telegramId } });
    if (r.count === 0) return M.linkTaken;
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "P2002") return M.linkTaken; // этот Telegram уже у другого сотрудника
    throw e;
  }
  await audit({ userId: u.id, action: "STAFF_TELEGRAM_LINKED", entity: "User", entityId: u.id });
  return M.staffLinked(u.name);
}

// ───────────── Смена и точка ─────────────

type Opened = { shiftId: string; locationId: string; locationName: string; auto: boolean };

/** Открытая смена сотрудника; если её нет, открываем сами (касса на старте 0). Точку выбираем без вопросов, когда она однозначна. */
async function ensureShift(user: StaffActor): Promise<Opened | { ask: string }> {
  const open = await getOpenShift(user.id);
  if (open) return { shiftId: open.id, locationId: open.locationId, locationName: open.location.name, auto: false };
  let locationId: string | null = null;
  if (!canSwitchLocation(user.role)) locationId = user.locationId;
  else {
    const last = await prisma.shift.findFirst({ where: { userId: user.id, location: { isActive: true } }, orderBy: { openedAt: "desc" }, select: { locationId: true } });
    const active = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    locationId = last?.locationId ?? (active.length === 1 ? active[0].id : null);
    if (!locationId) return { ask: M.chooseLocation(active) };
  }
  if (!locationId) throw new ApiError(403, "За вами не закреплена точка. Попросите владельца назначить её в админке.");
  const shiftId = await openShift({ locationId, openingCash: 0 }, user);
  const loc = await prisma.location.findUniqueOrThrow({ where: { id: locationId }, select: { name: true } });
  return { shiftId, locationId, locationName: loc.name, auto: true };
}

async function chooseLocationCmd(user: StaffActor, n: number | null): Promise<string[]> {
  const open = await getOpenShift(user.id);
  if (open) return [`Смена уже открыта на точке «${open.location.name}». Чтобы сменить точку, сначала закройте смену: «закрыть» и сумма в кассе.`];
  if (!canSwitchLocation(user.role)) return ["За вами закреплена одна точка, выбирать не нужно: просто пишите продажи."];
  const active = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  if (n == null) return [M.chooseLocation(active)];
  const loc = active[n - 1];
  if (!loc) return [M.chooseLocation(active)];
  await openShift({ locationId: loc.id, openingCash: 0 }, user);
  return [M.shiftOpened(loc.name)];
}

// ───────────── Продажа ─────────────

async function sellable(): Promise<MatchProduct[]> {
  const rows = await prisma.product.findMany({
    where: { isArchived: false, isAvailable: true, name: { not: MIX_PRODUCT_NAME } },
    include: { modifiers: { include: { options: { orderBy: [{ priceDelta: "asc" }, { name: "asc" }] } } } },
  });
  return rows.map((p) => ({
    id: p.id, name: p.name, price: Number(p.price),
    modifiers: p.modifiers.map((m) => ({ id: m.id, name: m.name, multiple: m.multiple, required: m.required, options: m.options.map((o) => ({ id: o.id, name: o.name, priceDelta: Number(o.priceDelta) })) })),
  }));
}

async function recordSale(user: StaffActor, text: string): Promise<string[]> {
  const parsed = parseSale(text, await sellable());
  if (!parsed.lines.length && !parsed.errors.length) return ["Не понял 🙂 Напишите, что продали, например: <code>яблочный сок</code> или <code>2 латте</code>.\n\n" + M.staffHelp];
  if (parsed.errors.length || !parsed.lines.length) return [M.saleFailed(parsed.errors, parsed.lines)];

  const out: string[] = [];
  const sh = await ensureShift(user);
  if ("ask" in sh) return [sh.ask];
  if (sh.auto) out.push(M.shiftOpened(sh.locationName));
  try {
    const r = await createPosOrder({ items: parsed.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, optionIds: l.optionIds })), method: parsed.method }, user);
    await prisma.order.update({ where: { id: r.orderId }, data: { note: `${NOTE_PREFIX}${text.trim().slice(0, 200)}` } }).catch((e) => console.error("[BOT SALE NOTE]", e));
    out.push(M.saleDone({ number: r.number, total: r.total, method: parsed.method, lines: parsed.lines, discount: r.discount }));
  } catch (e) {
    out.push(M.saleStopped(toMessage(e)));
  }
  return out;
}

// ───────────── Отмена, итог, закрытие смены ─────────────

async function undoLast(user: StaffActor): Promise<string[]> {
  const o = await prisma.order.findFirst({
    where: { cashierId: user.id, source: "POS", status: "COMPLETED", note: { startsWith: NOTE_PREFIX }, createdAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) } },
    orderBy: { createdAt: "desc" }, select: { id: true, number: true, total: true, createdAt: true },
  });
  if (!o) return [M.noSale];
  if (!can(user.role, "pos.refund") && Date.now() - o.createdAt.getTime() > UNDO_FREE_MS) return [M.undoDenied];
  try {
    await refundOrder({ orderId: o.id, reason: "Отмена в боте" }, user);
    return [M.undone(o.number, Number(o.total))];
  } catch (e) { return [M.saleStopped(toMessage(e))]; }
}

async function summary(user: StaffActor): Promise<string[]> {
  const shift = await getOpenShift(user.id);
  if (!shift) return [M.noShift];
  const [s, items] = await Promise.all([
    shiftSummary(shift.id),
    prisma.orderItem.findMany({ where: { order: { shiftId: shift.id, status: "COMPLETED" } }, select: { quantity: true, product: { select: { name: true } } } }),
  ]);
  if (!s) return [M.noShift];
  const by = new Map<string, number>();
  for (const i of items) by.set(i.product.name, (by.get(i.product.name) ?? 0) + i.quantity);
  const top = [...by].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
  return [M.summaryText({ location: s.location, since: s.openedAt, count: s.sales.count, total: s.sales.total, cash: s.sales.cash, card: s.sales.card, online: s.sales.online, refunds: s.refunds.count, top })];
}

async function closeCmd(user: StaffActor, amount: string | undefined): Promise<string[]> {
  const shift = await getOpenShift(user.id);
  if (!shift) return [M.noShift];
  const s = await shiftSummary(shift.id);
  if (!s) return [M.noShift];
  if (!amount) return [M.closeAsk(s.expectedCash)];
  const counted = Number(amount.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(counted) || counted < 0) return [M.closeAsk(s.expectedCash)];
  try { await closeShift({ closingCash: counted }, user); }
  catch (e) { return [M.saleStopped(toMessage(e))]; }
  return [M.closed(s.expectedCash, counted)];
}

/** Любое текстовое сообщение сотрудника: команда или запись продажи. Возвращает тексты ответов по порядку. */
export async function handleStaffText(user: StaffActor, raw: string): Promise<string[]> {
  const t = raw.trim().toLowerCase().replace(/^[^\p{L}\d]+/u, "").replace(/\s+/g, " ");
  try {
    if (/^(отмена|отменить|undo)$/.test(t)) return await undoLast(user);
    if (/^(итог|итоги|смена|касса)( дня| смены)?$/.test(t)) return await summary(user);
    const close = /^закрыть( смену)?(?: ([\d\s.,]+))?$/.exec(t);
    if (close) return await closeCmd(user, close[2]);
    const spot = /^точка(?: (\d+))?$/.exec(t);
    if (spot) return await chooseLocationCmd(user, spot[1] ? Number(spot[1]) : null);
    if (/^(помощь|справка|как)$/.test(t)) return [M.staffHelp];
    return await recordSale(user, raw);
  } catch (e) {
    return [M.saleStopped(toMessage(e))];
  }
}
