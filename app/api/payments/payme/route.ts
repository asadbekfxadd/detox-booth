import { NextRequest, NextResponse } from "next/server";
import { handlePayme, paymeConfig } from "@/services/payments/payme";
import { enabledProviders } from "@/services/payments";

/** Адрес для Payme Business (Merchant API). Всегда отвечаем HTTP 200: ошибки внутри JSON-RPC. */
export async function POST(req: NextRequest) {
  const cfg = paymeConfig();
  if (!cfg || !enabledProviders().some((p) => p.id === "payme")) return NextResponse.json({ error: "Payme не подключён" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 50_000) return NextResponse.json({ error: "Слишком большой запрос" }, { status: 413 });
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: { code: -32700, message: { ru: "Ошибка разбора", uz: "Tahlil xatosi", en: "Parse error" } }, id: null }); }
  return NextResponse.json(await handlePayme(body, req.headers.get("authorization"), cfg));
}
