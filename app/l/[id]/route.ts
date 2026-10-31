import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_LOC_COOKIE } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Вход по QR с ТВ-меню: запоминаем точку и открываем меню. Относительный Location: за прокси хост внутренний. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = /^[a-z0-9]{20,40}$/.test(id) ? await prisma.location.findFirst({ where: { id, isActive: true }, select: { id: true } }) : null;
  const res = new NextResponse(null, { status: 307, headers: { Location: "/menu", "Cache-Control": "no-store" } });
  if (ok) res.cookies.set(SITE_LOC_COOKIE, ok.id, { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });
  return res;
}
