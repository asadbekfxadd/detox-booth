"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { toMessage } from "@/lib/errors";
import { buildPreview, createFromPreview, type Preview } from "@/services/product-draft";

export async function previewDraftAction(text: string): Promise<{ preview: Preview } | { error: string }> {
  try {
    await requireUser("products.edit");
    return { preview: await buildPreview(text) };
  } catch (e) { return { error: toMessage(e) }; }
}

export async function createDraftAction(payload: string): Promise<{ error: string } | undefined> {
  let id: string;
  try {
    const u = await requireUser("products.edit");
    if (!can(u.role, "recipes.edit") || !can(u.role, "inventory.edit")) return { error: "Для создания продукта с рецептом нужен доступ к рецептам и складу" };
    id = (await createFromPreview(JSON.parse(payload), u.id)).id;
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/products");
  revalidatePath("/admin/recipes");
  revalidatePath("/menu");
  redirect(`/admin/recipes/${id}?created=1`);
}
