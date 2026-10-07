import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";

// Проверка RBAC: кассир получает 403, владелец/бухгалтер — 200
export async function GET() {
  try { const u = await requireUser("finance.view"); return NextResponse.json({ ok: true, role: u.role }); } catch (e) { return handleError(e); }
}
