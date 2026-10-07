"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createIngredient, updateIngredient, deleteIngredient, ingredientFromForm } from "@/services/ingredients";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createIngredientAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("inventory.edit");
    await createIngredient(ingredientFromForm(fd), u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/ingredients");
  redirect("/admin/ingredients?ok=created");
}

export async function updateIngredientAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("inventory.edit");
    await updateIngredient(s(fd, "id"), ingredientFromForm(fd), u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/ingredients");
  revalidatePath("/admin/recipes");
  redirect("/admin/ingredients?ok=updated");
}

export async function deleteIngredientAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("inventory.edit");
    await deleteIngredient(s(fd, "id"), u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/ingredients");
  redirect("/admin/ingredients?ok=deleted");
}

export type QuickIngredient = { id: string; name: string; unit: string; cost: number | null; stock: number };

/** Быстрое создание прямо из рецепта: название, единица и (необязательно) цена за кг/л/шт. Остальное можно дополнить позже. */
export async function quickCreateIngredientAction(input: { name: string; unit: string; price: string }): Promise<{ ingredient: QuickIngredient } | { error: string }> {
  try {
    const u = await requireUser("inventory.edit");
    const ing = await createIngredient({
      name: String(input.name ?? "").trim(), category: "Прочее", unit: String(input.unit ?? ""),
      price: String(input.price ?? "").trim() || "0", minStock: "0", shelfLifeDays: null, supplierId: null,
    }, u.id);
    revalidatePath("/admin/ingredients");
    return { ingredient: { id: ing.id, name: ing.name, unit: ing.unit, cost: Number(ing.avgCost), stock: 0 } };
  } catch (e) { return { error: toMessage(e) }; }
}
