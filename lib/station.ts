/** Станции кухни: чистая логика без БД. */

/** Значение фильтра «позиции без станции» (категория не привязана ни к одной станции). */
export const NO_STATION = "none";

export type StationLine = { stationId: string | null; readyAt: Date | string | null };

/** Фильтр станции из адреса: пусто — все позиции; неизвестное значение тоже считаем «все». */
export function parseStationFilter(raw: string | undefined | null, stationIds: string[]): string | null {
  if (!raw) return null;
  if (raw === NO_STATION) return NO_STATION;
  return stationIds.includes(raw) ? raw : null;
}

/** Позиции заказа, которые относятся к выбранной станции (null — все). */
export function linesFor<T extends StationLine>(lines: T[], filter: string | null): T[] {
  if (filter == null) return lines;
  if (filter === NO_STATION) return lines.filter((l) => l.stationId == null);
  return lines.filter((l) => l.stationId === filter);
}

/** Все выбранные позиции уже отмечены готовыми. Пустой набор не считается готовым. */
export const isDone = (lines: StationLine[]) => lines.length > 0 && lines.every((l) => l.readyAt != null);

/** Сколько позиций готово из скольких. */
export const progress = (lines: StationLine[]) => ({ done: lines.filter((l) => l.readyAt != null).length, total: lines.length });

/** Станции, у которых есть позиции в заказе (для подписи «бар + кухня»). */
export function stationsOf(lines: StationLine[]): (string | null)[] {
  return [...new Set(lines.map((l) => l.stationId))];
}
