"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import * as svc from "@/services/products";

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
export async function archiveAction(id: string, _p?: FormState) { return run((i, u) => svc.setArchived(i, true, u), id); }
export async function restoreAction(id: string, _p?: FormState) { return run((i, u) => svc.setArchived(i, false, u), id); }
export async function deleteAction(id: string, _p?: FormState) { return run((i, u) => svc.deleteProduct(i, u), id); }
export async function availabilityAction(id: string, value: boolean, _p?: FormState) { return run((i, u) => svc.setAvailable(i, value, u), id); }
