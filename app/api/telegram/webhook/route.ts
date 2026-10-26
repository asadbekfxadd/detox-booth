import { NextResponse } from "next/server";
import { safeEqual, telegramConfigured, webhookSecret } from "@/lib/telegram";
import { handleUpdate, type TgUpdate } from "@/services/telegram";

export const dynamic = "force-dynamic";

/**
 * Вебхук бота. Telegram присылает секрет в заголовке X-Telegram-Bot-Api-Secret-Token (мы задаём его при подключении).
 * Без верного секрета запрос отклоняется, чтобы никто не мог подсунуть боту чужие сообщения.
 * Любая ошибка обработки не должна давать не-200: иначе Telegram будет повторять тот же апдейт.
 */
export async function POST(req: Request) {
  if (!telegramConfigured()) return NextResponse.json({ ok: false }, { status: 404 });
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(got, webhookSecret())) return NextResponse.json({ ok: false }, { status: 401 });
  const text = await req.text();
  if (text.length > 100_000) return NextResponse.json({ ok: true });
  try { await handleUpdate(JSON.parse(text) as TgUpdate); }
  catch (e) { console.error("[TELEGRAM WEBHOOK]", e); }
  return NextResponse.json({ ok: true });
}
