"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { assignCourier, markDelivered } from "@/services/delivery";
import type { OpState } from "@/components/admin/ops";

const refresh = () => { revalidatePath("/admin/delivery"); revalidatePath("/courier"); revalidatePath("/kitchen"); };

export async function assignCourierAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("orders.manage");
    const courierId = String(fd.get("courierId") ?? "");
    await assignCourier({ orderId: String(fd.get("orderId") ?? ""), courierId: courierId || null }, u);
  } catch (e) { return { error: toMessage(e) }; }
  refresh();
  return undefined;
}

export async function markDeliveredAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("orders.manage"); await markDelivered(String(fd.get("orderId") ?? ""), u); }
  catch (e) { return { error: toMessage(e) }; }
  refresh();
  return undefined;
}
