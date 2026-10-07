import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { canSwitchLocation } from "@/lib/rbac";
import { listWriteOffs, writeOff } from "@/services/inventory";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser("writeoffs.create");
    const loc = req.nextUrl.searchParams.get("locationId");
    return NextResponse.json(await listWriteOffs(canSwitchLocation(u.role) ? loc : u.locationId));
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser("writeoffs.create");
    await writeOff(await req.json(), u);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) { return handleError(e); }
}
