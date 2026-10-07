import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { canSwitchLocation } from "@/lib/rbac";
import { listPurchases, createPurchase } from "@/services/purchases";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser("purchases.manage");
    const loc = req.nextUrl.searchParams.get("locationId");
    return NextResponse.json(await listPurchases(canSwitchLocation(u.role) ? loc : u.locationId, req.nextUrl.searchParams.get("status") ?? undefined));
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser("purchases.manage");
    const id = await createPurchase(await req.json(), u);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) { return handleError(e); }
}
