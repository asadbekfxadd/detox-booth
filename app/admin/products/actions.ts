"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { can } from "@/lib/rbac";
import * as svc from "@/services/products";
import { addCoffeeMenu } from "@/services/coffee-menu";

export type FormState = { error?: string } | undefined;

const fromForm = (fd: FormData) => ({
  ...Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")),
  isVegan: fd.get("isVegan") === "on", isHighProtein: fd.get("isHighProtein") === "on",
  isSugarFree: fd.get("isSugarFree") === "on", isAvailable: fd.get("isAvailable") === "on",
});

export async function createProductAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await requireUser("products.edit");
    await svc.createProduct(fromForm(fd), u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function updateProductAction(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await requireUser("products.edit");
    await svc.updateProduct(id, fromForm(fd), u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

async function run(fn: (id: string, userId: string) => Promise<unknown>, id: string): Promise<FormState> {
  try { const u = await requireUser("products.edit"); await fn(id, u.id); } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/products");
  return undefined;
}
export async function archiveAction(id: string) { return run((i, u) => svc.setArchived(i, true, u), id); }
export async function restoreAction(id: string) { return run((i, u) => svc.setArchived(i, false, u), id); }
export async function deleteAction(id: string) { return run((i, u) => svc.deleteProduct(i, u), id); }
export async function availabilityAction(id: string, value: boolean) { return run((i, u) => svc.setAvailable(i, value, u), id); }

/** Кнопка «Добавить кофейное меню»: нужен доступ к продуктам, рецептам и складу, потому что создаются и рецепты с ингредиентами. */
export async function addCoffeeMenuAction(): Promise<void> {
  let note: string;
  try {
    const u = await requireUser("products.edit");
    if (!can(u.role, "recipes.edit") || !can(u.role, "inventory.edit")) throw new Error("Для кофейного меню нужен доступ к рецептам и складу");
    const r = await addCoffeeMenu(u.id);
    note = `ok:${r.created.length}:${r.skipped.length}`;
  } catch (e) { note = `err:${toMessage(e)}`; }
  revalidatePath("/admin/products");
  revalidatePath("/admin/recipes");
  revalidatePath("/menu");
  redirect(`/admin/products?coffee=${encodeURIComponent(note)}`);
}
