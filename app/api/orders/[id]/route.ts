import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { getOrder, advanceOrder, cancelOrder, confirmPayment } from "@/services/orders";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const u = await requireUser("orders.view");
    const o = await getOrder((await params).id, u);
    if (!o) throw new ApiError(404, "Заказ не найден");
    return NextResponse.json(o);
  } catch (e) { return handleError(e); }
}

/** POST { action: "advance", to } | { action: "confirm-payment" } | { action: "cancel", reason, restock } */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { action?: string; to?: string; reason?: string; restock?: boolean };
    if (body.action === "cancel") { const u = await requireUser("orders.cancel"); await cancelOrder({ id, reason: body.reason ?? "", restock: !!body.restock }, u); }
    else if (body.action === "advance") { const u = await requireUser("orders.manage"); await advanceOrder({ id, to: body.to }, u); }
    else if (body.action === "confirm-payment") { const u = await requireUser("orders.manage"); await confirmPayment(id, u); }
    else throw new ApiError(400, "Неизвестное действие");
    return NextResponse.json({ ok: true });
  } catch (e) { return handleError(e); }
}
