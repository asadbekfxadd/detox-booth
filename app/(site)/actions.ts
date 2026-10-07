"use server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSiteLocation, SITE_LOC_COOKIE } from "@/lib/site";
import { quoteCart, type CartQuote } from "@/services/catalog";
import { quoteWeb, createWebOrder, type WebQuote } from "@/services/web-orders";
import { toMessage } from "@/lib/errors";

export async function setSiteLocation(id: string) {
  const ok = await prisma.location.findFirst({ where: { id, isActive: true }, select: { id: true } });
  if (!ok) return;
  (await cookies()).set(SITE_LOC_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });
}

export async function quoteCartAction(items: unknown): Promise<{ quote: CartQuote } | { error: string }> {
  try {
    const { current } = await getSiteLocation();
    return { quote: await quoteCart(items, current?.id ?? null) };
  } catch (e) { return { error: toMessage(e) }; }
}

export async function checkoutQuoteAction(input: unknown): Promise<{ quote: WebQuote } | { error: string }> {
  try {
    const { current } = await getSiteLocation();
    return { quote: await quoteWeb(input, current?.id ?? null) };
  } catch (e) { return { error: toMessage(e) }; }
}

export async function placeOrderAction(input: unknown): Promise<{ orderId: string } | { error: string }> {
  try {
    const { current } = await getSiteLocation();
    const r = await createWebOrder(input, current?.id ?? null);
    return { orderId: r.orderId };
  } catch (e) { return { error: toMessage(e) }; }
}
