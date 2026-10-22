"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { toMessage } from "@/lib/errors";
import { saveRecipe } from "@/services/recipes";

export type RecipeState = { error?: string } | undefined;

export async function saveRecipeAction(productId: string, _prev: RecipeState, fd: FormData): Promise<RecipeState> {
  try {
    const u = await requireUser("recipes.edit");
    let items: unknown, sizes: unknown, prices: unknown, sizeEdits: unknown;
    try {
      items = JSON.parse(String(fd.get("items") ?? "[]"));
      const raw = String(fd.get("sizes") ?? "");
      sizes = raw ? JSON.parse(raw) : undefined;
      const rp = String(fd.get("prices") ?? "");
      prices = rp && can(u.role, "products.cost") ? JSON.parse(rp) : undefined; // цены меняет только тот, кто видит себестоимость
      const rs = String(fd.get("sizeEdits") ?? "");
      sizeEdits = rs && can(u.role, "products.cost") ? JSON.parse(rs) : undefined;
    } catch { return { error: "Некорректные данные формы" }; }
    await saveRecipe(productId, { items, sizes, prices, sizeEdits }, u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/recipes");
  revalidatePath("/admin/products");
  redirect("/admin/recipes");
}
