/** Время получения заказа: слоты и проверка. Время всегда в UTC-миллисекундах; показ — по Ташкенту. */
export const SLOT_STEP_MIN = 15;
export const MAX_AHEAD_HOURS = 12;

/** Слоты «к времени»: первый — не раньше now + lead, шаг 15 минут, до MAX_AHEAD_HOURS вперёд. */
export function buildSlots(now: number, leadMin: number, stepMin = SLOT_STEP_MIN, hours = MAX_AHEAD_HOURS): string[] {
  const step = stepMin * 60_000;
  const first = Math.ceil((now + leadMin * 60_000) / step) * step;
  const last = now + hours * 3_600_000;
  const out: string[] = [];
  for (let t = first; t <= last; t += step) out.push(new Date(t).toISOString());
  return out;
}

/** Проверка выбранного времени на сервере. Возвращает Date или текст ошибки. */
export function checkScheduled(iso: string, now: number, leadMin: number): { ok: true; at: Date } | { ok: false; error: string } {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { ok: false, error: "Некорректное время получения" };
  // 60 секунд допуска: пока клиент оформлял, слот мог чуть «приблизиться»
  if (t < now + leadMin * 60_000 - 60_000) return { ok: false, error: `Выберите время не раньше чем через ${leadMin} мин` };
  if (t > now + (MAX_AHEAD_HOURS + 1) * 3_600_000) return { ok: false, error: `Заказать можно не дальше чем на ${MAX_AHEAD_HOURS} ч вперёд` };
  return { ok: true, at: new Date(t) };
}
