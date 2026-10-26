import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram: проверка данных Mini App и вызовы Bot API. Токен бота живёт только в переменной окружения (Railway Variables).
 * Адрес API можно подменить TELEGRAM_API_BASE (нужно для проверок без выхода в интернет).
 */
export const botToken = () => process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
export const telegramConfigured = () => botToken().length > 0;
const apiBase = () => (process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org").replace(/\/+$/, "");

/** Секрет вебхука: производный от AUTH_SECRET и токена, хранить отдельно не нужно. Telegram допускает A-Z a-z 0-9 _ - */
export function webhookSecret(token = botToken(), base = process.env.AUTH_SECRET ?? ""): string {
  return createHmac("sha256", `${base}|${token}`).update("vb-telegram-webhook").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type TgUser = { id: string; firstName: string; lastName: string | null; username: string | null; languageCode: string | null; allowsWrite: boolean };

/**
 * Проверка initData из Telegram.WebApp по документации Telegram: HMAC-SHA256 над отсортированными полями,
 * ключ — HMAC("WebAppData", токен бота). Данные старше maxAgeSec считаются просроченными.
 * Возвращает пользователя или null, если подпись неверна, данные устарели или формат странный.
 */
export function verifyInitData(initData: string, token: string, now = Date.now(), maxAgeSec = 24 * 3600): TgUser | null {
  if (!token || !initData || initData.length > 4096) return null;
  let params: URLSearchParams;
  try { params = new URLSearchParams(initData); } catch { return null; }
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete("hash");
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const calc = createHmac("sha256", secret).update(check).digest("hex");
  if (!safeEqual(calc, hash.toLowerCase())) return null;
  const at = Number(params.get("auth_date"));
  if (!Number.isFinite(at) || at <= 0) return null;
  const age = now / 1000 - at;
  if (age > maxAgeSec || age < -300) return null;
  try {
    const u = JSON.parse(params.get("user") ?? "null") as { id?: unknown; first_name?: unknown; last_name?: unknown; username?: unknown; language_code?: unknown; allows_write_to_pm?: unknown; is_bot?: unknown } | null;
    if (!u || typeof u.id !== "number" || !Number.isSafeInteger(u.id) || u.id <= 0 || u.is_bot === true) return null;
    return {
      id: String(u.id), firstName: typeof u.first_name === "string" && u.first_name ? u.first_name.slice(0, 80) : "Гость",
      lastName: typeof u.last_name === "string" ? u.last_name.slice(0, 80) : null, username: typeof u.username === "string" ? u.username.slice(0, 40) : null,
      languageCode: typeof u.language_code === "string" ? u.language_code.slice(0, 10) : null, allowsWrite: u.allows_write_to_pm === true,
    };
  } catch { return null; }
}

export type TgResult<T = unknown> = { ok: true; result: T } | { ok: false; code: number; description: string };

/** Вызов Bot API. Никогда не бросает исключение: сеть Telegram не должна ломать работу заведения. */
export async function tgCall<T = unknown>(method: string, body: Record<string, unknown> = {}, token = botToken()): Promise<TgResult<T>> {
  if (!token) return { ok: false, code: 0, description: "Токен бота не задан" };
  try {
    const r = await fetch(`${apiBase()}/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000), cache: "no-store" });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; result?: T; error_code?: number; description?: string } | null;
    if (j?.ok) return { ok: true, result: j.result as T };
    return { ok: false, code: j?.error_code ?? r.status, description: j?.description ?? `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, code: 0, description: e instanceof Error ? e.message : "Нет связи с Telegram" };
  }
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
