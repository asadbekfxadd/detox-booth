import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { can } from "@/lib/rbac";
import { listProducts, createProduct } from "@/services/products";

export async function GET(req: NextRequest) {
  try {
    const u = await requireUser("products.edit");
    const sp = req.nextUrl.searchParams;
    const rows = await listProducts({ q: sp.get("q") ?? undefined, categoryId: sp.get("category") ?? undefined, status: sp.get("status") ?? undefined }, can(u.role, "products.cost"));
    return NextResponse.json(rows);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser("products.edit");
    const p = await createProduct(await req.json(), u.id);
    return NextResponse.json({ id: p.id }, { status: 201 });
  } catch (e) { return handleError(e); }
}
