/**
 * Простой ограничитель частоты в памяти процесса (окно по времени).
 * Подходит для одного экземпляра сервера (как сейчас на Railway). Если приложение
 * масштабируется на несколько экземпляров, счётчики нужно вынести в Redis/БД.
 */
type Hit = { count: number; resetAt: number };
const store = new Map<string, Hit>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
}

/** Учитывает попытку. ok=false — лимит исчерпан, retryAfterSec — через сколько секунд можно повторить. */
export function hit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  sweep(now);
  const cur = store.get(key);
  if (!cur || cur.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  cur.count++;
  if (cur.count > limit) return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

/** Сбросить счётчик (например, после успешного входа). */
export function reset(key: string) { store.delete(key); }

/** Только для тестов. */
export function _clear() { store.clear(); }
