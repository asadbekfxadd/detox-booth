import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";

export async function GET() {
  try { return NextResponse.json(await requireUser()); } catch (e) { return handleError(e); }
}
