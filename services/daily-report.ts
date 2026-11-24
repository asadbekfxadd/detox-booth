import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { nowMs, tashkentDay } from "@/lib/time";
import { dayRange, prevDay, reportDue, dayStartMs } from "@/lib/report-day";
import { dailyReportText, reportDenied, reportHelp, reportOff, reportOn, type DayReport, type PlaceDay } from "@/lib/daily-report-text";
import { telegramConfigured, tgCall } from "@/lib/telegram";
import { getBrand } from "@/services/brand";
import { shiftSummary } from "@/services/pos";
import type { StaffActor } from "@/services/bot-sales";

/**
 * Каждую ночь в 00:00 по Ташкенту бот закрывает открытые смены и присылает итоги дня:
 * сколько продано, сумма, наличные и безнал. Отдельного планировщика на сервере нет, поэтому
 * сервер сам проверяет время раз в минуту, а повторную отправку (два экземпляра, перезапуск) исключает ключ в Setting.
 */
const SETTINGS_KEY = "daily-report";
const doneKey = (day: string) => `daily-report:done:${day}`;
const TICK_MS = 60_000;

type Cfg = { chats: string[]; muted: string[] };
const readCfg = async (): Promise<Cfg> => {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
  const v = (row?.value ?? {}) as Partial<Cfg>;
  return { chats: Array.isArray(v.chats) ? v.chats.map(String) : [], muted: Array.isArray(v.muted) ? v.muted.map(String) : [] };
};
const writeCfg = (c: Cfg) => prisma.setting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value: c }, update: { value: c } });

/** Кому слать: чаты, где написали «отчёт сюда», и лично владельцы с администраторами (кто не отключил). */
export async function recipients(): Promise<string[]> {
  const cfg = await readCfg();
  const bosses = await prisma.user.findMany({ where: { isActive: true, role: { in: ["OWNER", "ADMIN"] }, telegramId: { not: null } }, select: { telegramId: true } });
  const ids = bosses.map((b) => b.telegramId!).filter((id) => !cfg.muted.includes(id));
  return [...new Set([...cfg.chats, ...ids])];
}

/** Сводка за сутки: завершённые заказы по точкам. Оплаты считаем по факту: наличные и безнал (карта + онлайн) в сумме дают выручку. */
export async function collectDay(day: string, upTo?: Date): Promise<PlaceDay[]> {
  const { from, to } = dayRange(day);
  const end = upTo && upTo < to ? upTo : to;
  const [orders, refunded, locations] = await Promise.all([
    prisma.order.findMany({ where: { status: "COMPLETED", createdAt: { gte: from, lt: end } }, select: { locationId: true, items: { select: { quantity: true } }, payments: { where: { status: "PAID" }, select: { method: true, amount: true } } } }),
    prisma.payment.findMany({ where: { status: "REFUNDED", createdAt: { gte: from, lt: end }, order: { status: { not: "COMPLETED" } } }, select: { amount: true, order: { select: { locationId: true } } } }),
    prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const by = new Map<string, PlaceDay>(locations.map((l) => [l.id, { name: l.name, orders: 0, items: 0, total: 0, cash: 0, card: 0, online: 0, refunds: 0 }]));
  const place = (id: string) => by.get(id) ?? (by.set(id, { name: "Другая точка", orders: 0, items: 0, total: 0, cash: 0, card: 0, online: 0, refunds: 0 }), by.get(id)!);
  for (const o of orders) {
    const p = place(o.locationId);
    p.orders++;
    p.items += o.items.reduce((a, i) => a + i.quantity, 0);
    for (const pay of o.payments) {
      const a = Number(pay.amount);
      if (pay.method === "CASH") p.cash += a; else if (pay.method === "CARD") p.card += a; else p.online += a;
      p.total += a;
    }
  }
  for (const r of refunded) place(r.order.locationId).refunds += Number(r.amount);
  return [...by.values()];
}

/** Закрыть смены, открытые до сегодняшней полуночи. В кассе записываем сумму по системе: разницы нет, пересчитать нужно утром. */
export async function autoCloseShifts(now = nowMs()): Promise<{ place: string; cashier: string }[]> {
  const midnight = new Date(dayStartMs(tashkentDay(now)));
  const open = await prisma.shift.findMany({ where: { status: "OPEN", openedAt: { lt: midnight } }, select: { id: true, userId: true } });
  const closed: { place: string; cashier: string }[] = [];
  for (const sh of open) {
    try {
      const s = await shiftSummary(sh.id);
      if (!s) continue;
      const r = await prisma.shift.updateMany({ where: { id: sh.id, status: "OPEN" }, data: { status: "CLOSED", closedAt: new Date(now), closingCash: s.expectedCash } });
      if (r.count === 0) continue;
      closed.push({ place: s.location, cashier: s.cashier });
      await audit({ userId: sh.userId, action: "SHIFT_AUTO_CLOSED", entity: "Shift", entityId: sh.id, newValue: { closingCash: s.expectedCash, sales: s.sales, refunds: s.refunds } });
    } catch (e) { console.error("[DAILY REPORT] не закрылась смена", sh.id, e); }
  }
  return closed;
}

/** Название бренда для заголовка; планировщик работает вне запроса, поэтому сбой чтения не должен срывать отчёт. */
const brandName = () => getBrand().then((b) => b.name).catch(() => "Отчёт");

async function sendTo(chatId: string, text: string) {
  return tgCall("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
}

/** Закрыть кассу и разослать итоги за день. Возвращает false, если за этот день уже сделано (или кто-то делает прямо сейчас). */
export async function runDailyReport(day: string, now = nowMs()): Promise<boolean> {
  try { await prisma.setting.create({ data: { key: doneKey(day), value: { at: new Date(now).toISOString() } } }); }
  catch (e) { if ((e as { code?: string } | null)?.code === "P2002") return false; throw e; }
  try {
    const closed = await autoCloseShifts(now);
    const report: DayReport = { day, brand: await brandName(), places: await collectDay(day), closed };
    const text = dailyReportText(report);
    if (!telegramConfigured()) return true;
    const to = await recipients();
    const results = await Promise.all(to.map((id) => sendTo(id, text)));
    // никому не доставили (Telegram недоступен): снимаем отметку, следующая проверка повторит. Смены к тому времени уже закрыты.
    if (to.length > 0 && results.every((r) => !r.ok)) { await prisma.setting.delete({ where: { key: doneKey(day) } }).catch(() => undefined); console.error("[DAILY REPORT] не доставлен никому, повторим"); }
    return true;
  } catch (e) {
    await prisma.setting.delete({ where: { key: doneKey(day) } }).catch(() => undefined);
    throw e;
  }
}

/** Одна проверка: пора ли (00:00–06:00 по Ташкенту и за вчера ещё не делали). */
export async function tick(now = nowMs()): Promise<void> {
  const day = reportDue(now);
  if (!day) return;
  try { await runDailyReport(day, now); } catch (e) { console.error("[DAILY REPORT]", e); }
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startScheduler(): void {
  if (timer || process.env.DISABLE_SCHEDULER === "1") return;
  timer = setInterval(() => { void tick(); }, TICK_MS);
  timer.unref?.();
  console.log("[DAILY REPORT] планировщик запущен: закрытие кассы и итоги дня в 00:00 (Ташкент)");
  void tick();
}

// ───────────── Команды в боте ─────────────

/** «отчёт», «отчёт вчера», «отчёт сюда», «отчёт стоп». null — это не команда отчёта. */
export async function handleReportMessage(user: StaffActor, raw: string, chatId: string, isGroup: boolean, telegramId: string): Promise<string[] | null> {
  const t = raw.trim().toLowerCase().replace(/^[^\p{L}\d]+/u, "").replace(/\s+/g, " ");
  const m = /^отч[её]т(?: (сюда|стоп|вчера|сегодня|помощь))?$/.exec(t);
  if (!m) return null;
  if (!can(user.role, "dashboard.view")) return isGroup ? [] : [reportDenied];
  const arg = m[1];
  const cfg = await readCfg();
  if (arg === "сюда") {
    if (isGroup) { if (!cfg.chats.includes(chatId)) cfg.chats.push(chatId); }
    else cfg.muted = cfg.muted.filter((id) => id !== telegramId);
    await writeCfg(cfg);
    return [reportOn];
  }
  if (arg === "стоп") {
    if (isGroup) cfg.chats = cfg.chats.filter((id) => id !== chatId);
    else if (!cfg.muted.includes(telegramId)) cfg.muted.push(telegramId);
    await writeCfg(cfg);
    return [reportOff];
  }
  if (arg === "помощь") return [reportHelp];
  const today = tashkentDay(nowMs());
  const day = arg === "вчера" ? prevDay(today) : today;
  const places = await collectDay(day, new Date(nowMs()));
  return [dailyReportText({ day, brand: await brandName(), places, closed: [], partial: day === today })];
}
