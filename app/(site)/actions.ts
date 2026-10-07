"use server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSiteLocation, SITE_LOC_COOKIE } from "@/lib/site";
import { quoteCart, type CartQuote } from "@/services/catalog";
import { quoteWeb, createWebOrder, type WebQuote } from "@/services/web-orders";
import { toMessage } from "@/lib/errors";
import { clientIp } from "@/lib/client-ip";
import { hit } from "@/lib/rate-limit";

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
    // защита от массовых фейковых заказов: не больше 8 заказов за 10 минут с одного адреса
    const lim = hit(`order:ip:${await clientIp()}`, 8, 10 * 60_000);
    if (!lim.ok) return { error: `Слишком много заказов с вашего устройства. Повторите через ${Math.ceil(lim.retryAfterSec / 60)} мин.` };
    const { current } = await getSiteLocation();
    const r = await createWebOrder(input, current?.id ?? null);
    return { orderId: r.orderId };
  } catch (e) { return { error: toMessage(e) }; }
}
