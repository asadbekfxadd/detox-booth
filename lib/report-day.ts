import { TZ_OFFSET_MS, tashkentDay } from "@/lib/time";

const DAY_MS = 86400000;

/** Начало ташкентских суток (00:00 UTC+5) для даты YYYY-MM-DD, в миллисекундах UTC. */
export const dayStartMs = (day: string): number => Date.parse(`${day}T00:00:00Z`) - TZ_OFFSET_MS;

/** Сутки YYYY-MM-DD → [начало, конец) в UTC. */
export const dayRange = (day: string): { from: Date; to: Date } => ({ from: new Date(dayStartMs(day)), to: new Date(dayStartMs(day) + DAY_MS) });

/** Предыдущая дата YYYY-MM-DD. */
export const prevDay = (day: string): string => new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);

/** Сколько часов прошло с полуночи по Ташкенту. */
export const hoursSinceMidnight = (now: number): number => ((now + TZ_OFFSET_MS) % DAY_MS) / 3600000;

/**
 * Окно, в котором закрываем кассу и шлём отчёт: с 00:00 до 06:00 по Ташкенту.
 * Если сервис в полночь был выключен (деплой, сбой), он догонит после запуска, но не днём: смены в рабочее время сами не закрываем.
 * Возвращает день, за который делаем отчёт (вчерашний), или null вне окна.
 */
export function reportDue(now: number): string | null {
  return hoursSinceMidnight(now) < 6 ? prevDay(tashkentDay(now)) : null;
}

/** «23.11» из YYYY-MM-DD. */
export const dayLabel = (day: string): string => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
