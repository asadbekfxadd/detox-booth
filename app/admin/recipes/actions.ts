"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { saveRecipe } from "@/services/recipes";

export type RecipeState = { error?: string } | undefined;

export async function saveRecipeAction(productId: string, _prev: RecipeState, fd: FormData): Promise<RecipeState> {
  try {
    const u = await requireUser("recipes.edit");
    let items: unknown;
    try { items = JSON.parse(String(fd.get("items") ?? "[]")); } catch { return { error: "Некорректные данные формы" }; }
    await saveRecipe(productId, { items }, u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/recipes");
  revalidatePath("/admin/products");
  redirect("/admin/recipes");
}
