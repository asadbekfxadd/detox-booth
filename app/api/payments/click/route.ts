import { NextRequest, NextResponse } from "next/server";
import { clickConfig, handleClick, parseClickBody } from "@/services/payments/click";
import { enabledProviders } from "@/services/payments";

/** Адрес для Click (Shop API): prepare и complete приходят сюда. */
export async function POST(req: NextRequest) {
  const cfg = clickConfig();
  if (!cfg || !enabledProviders().some((p) => p.id === "click")) return NextResponse.json({ error: "Click не подключён" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 10_000) return NextResponse.json({ error: "Слишком большой запрос" }, { status: 413 });
  const ct = req.headers.get("content-type") ?? "";
  let b: Record<string, string>;
  if (ct.includes("application/json")) { try { b = Object.fromEntries(Object.entries(JSON.parse(raw) as Record<string, unknown>).map(([k, v]) => [k, String(v)])); } catch { b = {}; } }
  else b = parseClickBody(raw);
  try { return NextResponse.json(await handleClick(b, cfg)); }
  catch (e) { console.error("[CLICK]", e); return NextResponse.json({ error: -7, error_note: "Failed to update user" }); }
}
