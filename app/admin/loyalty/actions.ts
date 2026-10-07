"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createPromo, setPromoActive, deletePromo } from "@/services/promos";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createPromoAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("settings.edit");
    await createPromo({ code: s(fd, "code"), type: s(fd, "type"), value: s(fd, "value").replace(",", "."), minOrder: s(fd, "minOrder"), usageLimit: s(fd, "usageLimit"), expiresAt: s(fd, "expiresAt") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/loyalty");
  redirect("/admin/loyalty?ok=created");
}

export async function togglePromoAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await setPromoActive(s(fd, "id"), s(fd, "active") === "1", u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/loyalty");
  redirect("/admin/loyalty?ok=updated");
}

export async function deletePromoAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await deletePromo(s(fd, "id"), u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/loyalty");
  redirect("/admin/loyalty?ok=deleted");
}
