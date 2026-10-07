"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createPurchase, setPurchaseStatus, receivePurchase } from "@/services/purchases";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createPurchaseAction(_p: OpState, fd: FormData): Promise<OpState> {
  let id: string;
  try {
    const u = await requireUser("purchases.manage");
    let items: unknown;
    try { items = JSON.parse(s(fd, "items") || "[]"); } catch { return { error: "Некорректные данные" }; }
    id = await createPurchase({ locationId: s(fd, "locationId"), supplierId: s(fd, "supplierId"), intent: s(fd, "intent") || "ordered", items }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/purchases");
  redirect(`/admin/purchases/${id}?ok=created`);
}

export async function orderPurchaseAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("purchases.manage"); await setPurchaseStatus(s(fd, "id"), "ORDERED", u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/purchases");
  redirect(`/admin/purchases/${s(fd, "id")}?ok=ordered`);
}

export async function cancelPurchaseAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("purchases.manage"); await setPurchaseStatus(s(fd, "id"), "CANCELLED", u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/purchases");
  redirect(`/admin/purchases/${s(fd, "id")}?ok=cancelled`);
}

export async function receivePurchaseAction(_p: OpState, fd: FormData): Promise<OpState> {
  const id = s(fd, "id");
  try {
    const u = await requireUser("purchases.manage");
    const lines = [...fd.keys()].filter((k) => k.startsWith("qty_")).map((k) => {
      const itemId = k.slice(4);
      return { itemId, quantity: s(fd, k).replace(",", "."), unitCost: s(fd, `cost_${itemId}`).replace(",", "."), expiresAt: s(fd, `exp_${itemId}`) };
    });
    await receivePurchase(id, { lines }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/inventory");
  redirect(`/admin/purchases/${id}?ok=received`);
}
