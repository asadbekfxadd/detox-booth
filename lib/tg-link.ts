import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/telegram";

/**
 * Одноразовая ссылка для привязки Telegram сотрудника: https://t.me/<бот>?start=link_<токен>.
 * Токен = id сотрудника + срок + подпись (HMAC от AUTH_SECRET), поэтому хранить его в базе не нужно.
 * Параметр start у Telegram: до 64 символов из A-Z a-z 0-9 _ -, id сотрудника (cuid) состоит только из букв и цифр.
 * «Одноразовость» обеспечивает сервис: привязать можно только сотрудника, у которого Telegram ещё не привязан.
 */
export const LINK_PREFIX = "link_";
export const LINK_TTL_MS = 15 * 60 * 1000;

const sign = (userId: string, exp: string, secret: string) =>
  createHmac("sha256", secret).update(`vb-staff-link|${userId}|${exp}`).digest("base64url").slice(0, 14);

const secretOf = () => process.env.AUTH_SECRET ?? "";

export function makeLinkToken(userId: string, now = Date.now(), secret = secretOf()): string {
  const exp = Math.floor((now + LINK_TTL_MS) / 1000).toString(36);
  return `${userId}_${exp}_${sign(userId, exp, secret)}`;
}

/** id сотрудника из верного непросроченного токена, иначе null */
export function readLinkToken(token: string, now = Date.now(), secret = secretOf()): string | null {
  if (!secret || token.length > 60 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const parts = token.split("_");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!userId || !exp || !sig) return null;
  if (!safeEqual(sig, sign(userId, exp, secret))) return null;
  const at = parseInt(exp, 36) * 1000;
  if (!Number.isFinite(at) || at < now) return null;
  return userId;
}

/** Параметр /start → токен привязки (или null, если это не привязка) */
export const linkPayload = (startArg: string | undefined): string | null =>
  startArg && startArg.startsWith(LINK_PREFIX) ? startArg.slice(LINK_PREFIX.length) : null;
