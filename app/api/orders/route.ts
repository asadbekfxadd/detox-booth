import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { canSwitchLocation } from "@/lib/rbac";
import { listOrders } from "@/services/orders";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser("orders.view");
    const g = (k: string) => req.nextUrl.searchParams.get(k) ?? undefined;
    const loc = g("locationId") ?? null;
    return NextResponse.json(await listOrders(canSwitchLocation(u.role) ? loc : u.locationId, {
      status: g("status"), source: g("source"), method: g("method"), from: g("from"), to: g("to"), q: g("q"), page: Number(g("page")) || 1,
    }));
  } catch (e) { return handleError(e); }
}
