import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { canSwitchLocation } from "@/lib/rbac";
import { getStockOverview, stockIn } from "@/services/inventory";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser("inventory.view");
    const loc = req.nextUrl.searchParams.get("locationId");
    const scope = canSwitchLocation(u.role) ? loc : u.locationId;
    return NextResponse.json(await getStockOverview(scope));
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser("inventory.edit");
    await stockIn(await req.json(), u);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) { return handleError(e); }
}
