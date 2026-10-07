import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { listSuppliers, createSupplier } from "@/services/suppliers";

export async function GET() {
  try { await requireUser("purchases.manage"); return NextResponse.json(await listSuppliers()); }
  catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser("purchases.manage");
    const id = await createSupplier(await req.json(), u.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) { return handleError(e); }
}
