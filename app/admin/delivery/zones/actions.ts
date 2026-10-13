"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createZone, updateZone, deleteZone } from "@/services/delivery";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const body = (fd: FormData) => ({ locationId: s(fd, "locationId"), name: s(fd, "name"), fee: s(fd, "fee"), minOrder: s(fd, "minOrder"), freeFrom: s(fd, "freeFrom"), sort: s(fd, "sort"), isActive: fd.get("isActive") === "on" });
const done = (ok: string) => { revalidatePath("/admin/delivery/zones"); revalidatePath("/checkout"); redirect(`/admin/delivery/zones?ok=${ok}`); };

export async function createZoneAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await createZone(body(fd), u); }
  catch (e) { return { error: toMessage(e) }; }
  done("created");
}
export async function updateZoneAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await updateZone(s(fd, "id"), body(fd), u); }
  catch (e) { return { error: toMessage(e) }; }
  done("updated");
}
export async function deleteZoneAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await deleteZone(s(fd, "id"), u); }
  catch (e) { return { error: toMessage(e) }; }
  done("deleted");
}
