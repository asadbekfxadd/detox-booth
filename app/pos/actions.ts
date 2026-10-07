"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import {
  openShift, closeShift, quote, createPosOrder, refundOrder, recentOrders, searchCustomers, createQuickCustomer,
  type CustomerLite, type OrderResult, type Quote, type RecentOrder,
} from "@/services/pos";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function openShiftAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("pos.use");
    await openShift({ locationId: s(fd, "locationId"), openingCash: s(fd, "openingCash").replace(",", ".") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  redirect("/pos");
}

export async function closeShiftAction(_p: OpState, fd: FormData): Promise<OpState> {
  let id: string;
  try {
    const u = await requireUser("pos.use");
    id = await closeShift({ closingCash: s(fd, "closingCash").replace(",", ".") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  redirect(`/pos/shift/${id}`);
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function quoteAction(input: unknown): Promise<Quote> {
  try { const u = await requireUser("pos.use"); return { ok: true, ...(await quote(input, u)) }; }
  catch (e) { return { ok: false, error: toMessage(e) }; }
}

export async function createOrderAction(input: unknown): Promise<OrderResult> {
  try {
    const u = await requireUser("pos.use");
    const r = await createPosOrder(input, u);
    revalidatePath("/pos");
    return r;
  } catch (e) { return { ok: false, error: toMessage(e) }; }
}

export async function searchCustomersAction(q: string): Promise<{ ok: true; customers: CustomerLite[] } | { ok: false; error: string }> {
  try { await requireUser("pos.use"); return { ok: true, customers: await searchCustomers(String(q ?? "")) }; }
  catch (e) { return { ok: false, error: toMessage(e) }; }
}

export async function createCustomerAction(input: unknown): Promise<{ ok: true; customer: CustomerLite } | { ok: false; error: string }> {
  try { const u = await requireUser("pos.use"); return { ok: true, customer: await createQuickCustomer(input, u) }; }
  catch (e) { return { ok: false, error: toMessage(e) }; }
}

export async function recentOrdersAction(): Promise<{ ok: true; orders: RecentOrder[] } | { ok: false; error: string }> {
  try { const u = await requireUser("pos.use"); return { ok: true, orders: await recentOrders(u) }; }
  catch (e) { return { ok: false, error: toMessage(e) }; }
}

export async function refundOrderAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const u = await requireUser("pos.refund");
    await refundOrder(input, u);
    revalidatePath("/pos");
    return { ok: true };
  } catch (e) { return { ok: false, error: toMessage(e) }; }
}
