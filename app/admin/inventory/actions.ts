"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { stockInMany, transfer, countInventory } from "@/services/inventory";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function stockInManyAction(_p: OpState, fd: FormData): Promise<OpState> {
  let n = 0;
  try {
    const u = await requireUser("inventory.edit");
    let items: unknown;
    try { items = JSON.parse(s(fd, "items")); } catch { return { error: "Некорректные данные прихода" }; }
    n = await stockInMany({ locationId: s(fd, "locationId"), items }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/inventory");
  redirect(`/admin/inventory?ok=stockin&n=${n}`);
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
