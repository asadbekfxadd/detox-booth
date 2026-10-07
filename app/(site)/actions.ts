"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSiteLocation, SITE_LOC_COOKIE } from "@/lib/site";
import { quoteCart, type CartQuote } from "@/services/catalog";
import { quoteWeb, createWebOrder, getOrdersBrief, type OrderBrief, type WebQuote } from "@/services/web-orders";
import { toMessage } from "@/lib/errors";
import { clientIp } from "@/lib/client-ip";
import { hit } from "@/lib/rate-limit";
import { getCurrentTable } from "@/lib/site-table";
import { createTableOrder, requestBill } from "@/services/tables";
import { TABLE_COOKIE } from "@/lib/tables";

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

export async function placeOrderAction(input: unknown): Promise<{ orderId: string; payUrl: string | null } | { error: string }> {
  try {
    // защита от массовых фейковых заказов: не больше 8 заказов за 10 минут с одного адреса
    const lim = hit(`order:ip:${await clientIp()}`, 8, 10 * 60_000);
    if (!lim.ok) return { error: `Слишком много заказов с вашего устройства. Повторите через ${Math.ceil(lim.retryAfterSec / 60)} мин.` };
    const { current } = await getSiteLocation();
    const r = await createWebOrder(input, current?.id ?? null);
    return { orderId: r.orderId, payUrl: r.payUrl };
  } catch (e) { return { error: toMessage(e) }; }
}

export async function myOrdersAction(ids: unknown): Promise<{ orders: OrderBrief[] } | { error: string }> {
  try { return { orders: await getOrdersBrief(ids) }; }
  catch (e) { return { error: toMessage(e) }; }
}

/** Заказ гостя за столом: уходит на кухню и попадает в счёт стола. Стол берём из cookie, поставленной по QR. */
export async function placeTableOrderAction(input: unknown): Promise<{ ok: true } | { error: string }> {
  try {
    const table = await getCurrentTable();
    if (!table) return { error: "Не нашли ваш стол. Отсканируйте QR-код на столе ещё раз." };
    const lim = hit(`table-order:${table.id}`, 15, 10 * 60_000);
    const ipLim = hit(`table-order:ip:${await clientIp()}`, 30, 10 * 60_000);
    if (!lim.ok || !ipLim.ok) return { error: "Слишком много заказов за короткое время. Подождите несколько минут или позовите официанта." };
    await createTableOrder(input, table);
    revalidatePath("/table");
    return { ok: true };
  } catch (e) { return { error: toMessage(e) }; }
}

/** «Попросить счёт» на странице стола. */
export async function requestBillAction(): Promise<void> {
  const table = await getCurrentTable();
  if (!table) return;
  if (!hit(`table-bill:${table.id}`, 10, 10 * 60_000).ok) return;
  try { await requestBill(table); } catch { /* нет заказов или счёт уже закрыт: страница покажет актуальное состояние */ }
  revalidatePath("/table");
}

/** «Это не мой стол»: отвязать устройство от стола. */
export async function leaveTableAction(): Promise<void> {
  (await cookies()).delete(TABLE_COOKIE);
  redirect("/menu");
}
