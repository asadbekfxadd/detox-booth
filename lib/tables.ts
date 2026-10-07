import { randomBytes } from "node:crypto";

/** Cookie со столом гостя: ставится при открытии QR-ссылки /t/<токен>. */
export const TABLE_COOKIE = "site_table";
/** Через сколько часов гость «отвязывается» от стола сам (на случай, если ушёл, а страница осталась). */
export const TABLE_COOKIE_HOURS = 4;

/** 32 hex-символа, криптостойкий случайный токен для QR. */
export const newTableToken = () => randomBytes(16).toString("hex");
export const isTableToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{32}$/.test(t);
