/** Все отчёты и «сегодня» считаются по Ташкенту (UTC+5, без перехода на летнее время). */
export const TZ_OFFSET_MS = 5 * 3600000;

/** Текущее время. Вынесено в функцию, чтобы серверные страницы не вызывали Date.now() прямо в рендере. */
export const nowMs = (): number => Date.now();

/** Дата YYYY-MM-DD в Ташкенте. */
export const tashkentDay = (d: Date | number = nowMs()): string =>
  new Date((typeof d === "number" ? d : d.getTime()) + TZ_OFFSET_MS).toISOString().slice(0, 10);
