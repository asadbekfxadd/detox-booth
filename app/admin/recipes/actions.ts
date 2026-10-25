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
    let body: Record<string, unknown>;
    try {
      body = {};
      for (const k of ["items", "sizes", "prices", "yields"]) { const raw = String(fd.get(k) ?? ""); if (raw) body[k] = JSON.parse(raw); }
      for (const k of ["name", "price"]) { const raw = String(fd.get(k) ?? ""); if (raw !== "") body[k] = raw; }
    } catch { return { error: "Некорректные данные формы" }; }
    // название, цена и размеры: как в карточке продукта; цены ингредиентов: только тем, кто видит себестоимость
    if (!can(u.role, "products.edit") && (body.name !== undefined || body.price !== undefined || body.sizes !== undefined)) return { error: "Менять название, цену и размеры продукта может только тот, у кого есть доступ к продуктам" };
    if (!can(u.role, "products.cost")) delete body.prices;
    if (body.yields !== undefined && !can(u.role, "inventory.edit")) return { error: "Менять выход годного может только тот, у кого есть доступ к складу" }; // выход — свойство ингредиента, как его цена и единица
    await saveRecipe(productId, body, u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/recipes");
  revalidatePath("/admin/products");
  redirect("/admin/recipes");
}
