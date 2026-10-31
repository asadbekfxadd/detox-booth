"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { applyDrinkPhotos } from "@/services/drink-photos";

export async function applyDrinkPhotosAction(rows: { productId: string; key: string }[]): Promise<{ error: string } | undefined> {
  let n: number;
  try {
    const u = await requireUser("products.edit");
    n = await applyDrinkPhotos(Array.isArray(rows) ? rows.map((r) => ({ productId: String(r?.productId ?? ""), key: String(r?.key ?? "") })) : [], u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/products"); revalidatePath("/menu"); revalidatePath("/", "layout");
  redirect(`/admin/products/photos?ok=${n}`);
}
