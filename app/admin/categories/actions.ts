"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createCategory, updateCategory, deleteCategory } from "@/services/categories";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const done = (ok: string) => { revalidatePath("/admin/categories"); revalidatePath("/admin/products"); revalidatePath("/menu"); redirect(`/admin/categories?ok=${ok}`); };

export async function createCategoryAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("products.edit"); await createCategory({ name: s(fd, "name"), sort: s(fd, "sort") }, u.id); }
  catch (e) { return { error: toMessage(e) }; }
  done("created");
}
export async function updateCategoryAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("products.edit"); await updateCategory(s(fd, "id"), { name: s(fd, "name"), sort: s(fd, "sort") }, u.id); }
  catch (e) { return { error: toMessage(e) }; }
  done("updated");
}
export async function deleteCategoryAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("products.edit"); await deleteCategory(s(fd, "id"), u.id); }
  catch (e) { return { error: toMessage(e) }; }
  done("deleted");
}
