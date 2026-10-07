import { NextRequest, NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { getRecipe, saveRecipe } from "@/services/recipes";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    await requireUser("recipes.edit");
    const { productId } = await params;
    const r = await getRecipe(productId);
    return r ? NextResponse.json(r) : NextResponse.json({ error: "Продукт не найден" }, { status: 404 });
  } catch (e) { return handleError(e); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const u = await requireUser("recipes.edit");
    const { productId } = await params;
    await saveRecipe(productId, await req.json(), u.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return handleError(e); }
}
