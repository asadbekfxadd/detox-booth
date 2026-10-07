import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { updateProduct, deleteProduct } from "@/services/products";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser("products.edit");
    const { id } = await params;
    await updateProduct(id, await req.json(), u.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser("products.edit");
    const { id } = await params;
    await deleteProduct(id, u.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return handleError(e); }
}
