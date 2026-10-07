"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { advanceOrder, confirmPayment, cancelOrder } from "@/services/orders";
import { refundOrder } from "@/services/pos";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
/** Куда вернуться: только внутрь раздела заказов (защита от open redirect). */
const back = (fd: FormData, id: string, ok: string) => {
  const b = s(fd, "back");
  return b.startsWith("/admin/orders") && !b.startsWith("//") ? b : `/admin/orders/${id}?ok=${ok}`;
};

export async function advanceOrderAction(_p: OpState, fd: FormData): Promise<OpState> {
  const id = s(fd, "id");
  try { const u = await requireUser("orders.manage"); await advanceOrder({ id, to: s(fd, "to") }, u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/orders"); revalidatePath("/admin/inventory");
  redirect(back(fd, id, "status"));
}

export async function confirmPaymentAction(_p: OpState, fd: FormData): Promise<OpState> {
  const id = s(fd, "id");
  try { const u = await requireUser("orders.manage"); await confirmPayment(id, u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/orders");
  redirect(back(fd, id, "paid"));
}

export async function cancelOrderAction(_p: OpState, fd: FormData): Promise<OpState> {
  const id = s(fd, "id");
  try {
    const u = await requireUser("orders.cancel");
    await cancelOrder({ id, reason: s(fd, "reason"), restock: s(fd, "restock") === "on" }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/orders"); revalidatePath("/admin/inventory");
  redirect(`/admin/orders/${id}?ok=cancelled`);
}

export async function refundOrderAdminAction(_p: OpState, fd: FormData): Promise<OpState> {
  const id = s(fd, "id");
  try { const u = await requireUser("pos.refund"); await refundOrder({ orderId: id, reason: s(fd, "reason") }, u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${id}?ok=refunded`);
}
