import { NextResponse } from "next/server";
import { getTableByToken } from "@/services/tables";
import { TABLE_COOKIE, TABLE_COOKIE_HOURS } from "@/lib/tables";
import { SITE_LOC_COOKIE } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Вход по QR на столе: запоминаем стол и точку в cookie и открываем меню. Относительный Location: за прокси хост внутренний. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const table = await getTableByToken(token);
  if (!table) return new NextResponse(null, { status: 307, headers: { Location: "/table" } });
  const res = new NextResponse(null, { status: 307, headers: { Location: "/menu", "Cache-Control": "no-store" } });
  const maxAge = TABLE_COOKIE_HOURS * 3600;
  res.cookies.set(TABLE_COOKIE, token, { path: "/", maxAge, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.cookies.set(SITE_LOC_COOKIE, table.locationId, { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });
  return res;
}
