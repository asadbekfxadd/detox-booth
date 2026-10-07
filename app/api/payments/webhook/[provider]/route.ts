import { NextRequest, NextResponse } from "next/server";
import { applyPaymentResult, getProvider } from "@/services/payments";

/** Вебхук платёжного провайдера. Доверяем только телу с верной подписью; повторы безопасны. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const p = getProvider(provider);
  if (!p) return NextResponse.json({ error: "Провайдер не подключён" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 10_000) return NextResponse.json({ error: "Слишком большой запрос" }, { status: 413 });
  const event = p.verifyWebhook(raw, req.headers);
  if (!event) return NextResponse.json({ error: "Неверная подпись" }, { status: 401 });
  try {
    const r = await applyPaymentResult(p.id, event.externalId, event.status, event.amount);
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: r.reason === "not_found" ? 404 : 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PAYMENT WEBHOOK]", e);
    return NextResponse.json({ error: "Ошибка обработки" }, { status: 500 });
  }
}
