"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createSupplier, updateSupplier, deleteSupplier } from "@/services/suppliers";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createSupplierAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("purchases.manage");
    await createSupplier({ name: s(fd, "name"), phone: s(fd, "phone") }, u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers?ok=created");
}

export async function updateSupplierAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("purchases.manage");
    await updateSupplier(s(fd, "id"), { name: s(fd, "name"), phone: s(fd, "phone") }, u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers?ok=updated");
}

export async function deleteSupplierAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("purchases.manage");
    await deleteSupplier(s(fd, "id"), u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/suppliers");
  redirect("/admin/suppliers?ok=deleted");
}
