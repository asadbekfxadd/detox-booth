"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { advanceOrder } from "@/services/orders";
import { createWaiterOrder, fireHeld, cancelHeldOrder, requestBillStaff, moveTable } from "@/services/waiter";

export type WaiterOrderResult = { ok: true; number: number; tableId: string } | { ok: false; error: string };

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function createWaiterOrderAction(input: unknown): Promise<WaiterOrderResult> {
  try {
    const u = await requireUser("waiter.use");
    const r = await createWaiterOrder(input, u);
    revalidatePath("/waiter");
    return { ok: true, number: r.number, tableId: r.tableId };
  } catch (e) { return { ok: false, error: toMessage(e) }; }
}

const back = (tableId: string, error?: string, ok?: string) => {
  const q = error ? `?error=${encodeURIComponent(error)}` : ok ? `?ok=${encodeURIComponent(ok)}` : "";
  return redirect(`/waiter/tables/${tableId}${q}`);
};
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/** На кухню: один заказ, целая подача или все отложенные заказы стола. */
export async function fireAction(fd: FormData): Promise<void> {
  const tableId = s(fd, "tableId");
  let n = 0;
  try {
    const u = await requireUser("waiter.use");
    const course = Number(s(fd, "course")) || undefined;
    n = (await fireHeld({ tableId, orderId: s(fd, "orderId") || undefined, course }, u)).count;
  } catch (e) { return back(tableId, toMessage(e)); }
  revalidatePath("/waiter");
  back(tableId, undefined, n === 1 ? "Отправлено на кухню" : `Отправлено на кухню: ${n}`);
}

export async function cancelHeldAction(fd: FormData): Promise<void> {
  const tableId = s(fd, "tableId");
  try { const u = await requireUser("waiter.use"); await cancelHeldOrder({ tableId, orderId: s(fd, "orderId") }, u); }
  catch (e) { return back(tableId, toMessage(e)); }
  revalidatePath("/waiter");
  back(tableId, undefined, "Заказ отменён");
}

export async function serveAction(fd: FormData): Promise<void> {
  const tableId = s(fd, "tableId");
  try { const u = await requireUser("waiter.use"); await advanceOrder({ id: s(fd, "orderId"), to: "COMPLETED" }, u); }
  catch (e) { return back(tableId, toMessage(e)); }
  revalidatePath("/waiter");
  back(tableId, undefined, "Отмечено как поданное");
}

export async function requestBillAction(fd: FormData): Promise<void> {
  const tableId = s(fd, "tableId");
  try { const u = await requireUser("waiter.use"); await requestBillStaff(tableId, u); }
  catch (e) { return back(tableId, toMessage(e)); }
  revalidatePath("/waiter");
  back(tableId, undefined, "Касса увидит, что стол просит счёт");
}

export async function moveTableAction(fd: FormData): Promise<void> {
  const fromTableId = s(fd, "tableId");
  let to: string;
  try {
    const u = await requireUser("waiter.use");
    to = (await moveTable({ fromTableId, toTableId: s(fd, "toTableId") }, u)).toTableId;
  } catch (e) { return back(fromTableId, toMessage(e)); }
  revalidatePath("/waiter");
  back(to, undefined, "Стол перенесён");
}
