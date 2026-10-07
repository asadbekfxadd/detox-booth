"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { stockIn, transfer, countInventory } from "@/services/inventory";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function stockInAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("inventory.edit");
    await stockIn({ locationId: s(fd, "locationId"), ingredientId: s(fd, "ingredientId"), quantity: s(fd, "quantity"), unitCost: s(fd, "unitCost"), expiresAt: s(fd, "expiresAt") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory?ok=stockin");
}

export async function transferAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("inventory.edit");
    await transfer({ fromLocationId: s(fd, "fromLocationId"), toLocationId: s(fd, "toLocationId"), ingredientId: s(fd, "ingredientId"), quantity: s(fd, "quantity") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory?ok=transfer");
}

export async function countAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("inventory.edit");
    const items = [...fd.entries()]
      .filter(([k, v]) => k.startsWith("actual_") && typeof v === "string" && v.trim() !== "")
      .map(([k, v]) => ({ ingredientId: k.slice(7), actual: String(v).replace(",", ".") }));
    await countInventory({ locationId: s(fd, "locationId"), items }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory/variance?ok=count");
}
