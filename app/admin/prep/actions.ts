"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { savePrep, deletePrep, produce } from "@/services/prep";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function savePrepAction(_p: OpState, fd: FormData): Promise<OpState> {
  let id = "";
  try {
    const u = await requireUser("recipes.edit");
    let body: unknown;
    try { body = JSON.parse(s(fd, "payload")); } catch { return { error: "Некорректные данные формы" }; }
    id = await savePrep(body, u.id);
  } catch (e) { return { error: toMessage(e) }; }
  for (const p of ["/admin/prep", "/admin/inventory", "/admin/recipes"]) revalidatePath(p);
  redirect(`/admin/prep/${id}?ok=saved`);
}

export async function producePrepAction(_p: OpState, fd: FormData): Promise<OpState> {
  let n = 0;
  try {
    const u = await requireUser("inventory.edit");
    const r = await produce({ locationId: s(fd, "locationId"), ingredientId: s(fd, "ingredientId"), quantity: s(fd, "quantity"), actualQty: s(fd, "actualQty"), note: s(fd, "note") }, u);
    n = r.number;
  } catch (e) { return { error: toMessage(e) }; }
  for (const p of ["/admin/prep", "/admin/inventory", "/admin/inventory/turnover", "/admin/recipes"]) revalidatePath(p);
  redirect(`/admin/prep?ok=produced&n=${n}`);
}

export async function deletePrepAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("recipes.edit");
    await deletePrep(s(fd, "id"), u.id);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/prep");
  redirect("/admin/prep?ok=deleted");
}
