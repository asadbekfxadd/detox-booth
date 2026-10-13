import { TZ_OFFSET_MS } from "@/lib/time";
import { hhmm } from "@/lib/happy-hour";

export type Slot = { startsAt: number; durationMin: number };
export type BookingTable = { id: string; number: number; seats: number };
export type Busy = { tableId: string | null; startsAt: number; durationMin: number };

/** Пересекаются ли два интервала. Брони «впритык» (одна кончается, другая начинается) не пересекаются. */
export const overlaps = (a: Slot, b: Slot) => a.startsAt < b.startsAt + b.durationMin * 60000 && b.startsAt < a.startsAt + a.durationMin * 60000;

/** Самый компактный свободный стол, куда помещаются гости: меньше мест — лучше, затем меньший номер. */
export function pickTable(tables: BookingTable[], busy: Busy[], slot: Slot, guests: number): BookingTable | null {
  const free = tables
    .filter((t) => t.seats >= guests)
    .filter((t) => !busy.some((b) => b.tableId === t.id && overlaps(slot, b)))
    .sort((a, b) => a.seats - b.seats || a.number - b.number);
  return free[0] ?? null;
}

/** Время начала в Ташкенте: из даты YYYY-MM-DD и HH:MM → миллисекунды UTC. */
export function toUtc(day: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const ms = Date.parse(`${day}T${time}:00Z`);
  if (Number.isNaN(ms)) return null;
  const back = new Date(ms).toISOString();
  if (!back.startsWith(`${day}T${time}`)) return null; // 31 февраля и т. п.
  return ms - TZ_OFFSET_MS;
}

/** Время начала брони каждые 30 минут: с открытия до закрытия (последняя бронь не позже closeHour). */
export function slotTimes(openHour: number, closeHour: number, stepMin = 30): string[] {
  const out: string[] = [];
  for (let m = openHour * 60; m <= closeHour * 60; m += stepMin) out.push(hhmm(m));
  return out;
}

export type WhenCheck = { ok: true } | { ok: false; error: string };
/** Бронь не раньше чем через leadMin минут и не позже чем через maxDays дней. */
export function checkWhen(startsAtMs: number, nowMs: number, leadMin: number, maxDays: number): WhenCheck {
  if (startsAtMs < nowMs + leadMin * 60000) return { ok: false, error: `Бронь возможна минимум за ${leadMin >= 60 && leadMin % 60 === 0 ? `${leadMin / 60} ч` : `${leadMin} мин`} до визита` };
  if (startsAtMs > nowMs + maxDays * 86400000) return { ok: false, error: `Бронь открыта на ${maxDays} дн. вперёд` };
  return { ok: true };
}

export const STATUS_LABEL: Record<string, string> = { PENDING: "Ждёт подтверждения", CONFIRMED: "Подтверждена", SEATED: "Гости пришли", CANCELLED: "Отменена", NO_SHOW: "Не пришли" };
export const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "SEATED"] as const;
