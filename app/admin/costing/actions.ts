"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createEquipment, updateEquipment, setEquipmentActive, deleteEquipment } from "@/services/costing";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const fields = (fd: FormData) => ({ name: s(fd, "name"), price: s(fd, "price"), lifeDrinks: s(fd, "lifeDrinks"), categoryId: s(fd, "categoryId") });
const done = (ok: string) => { revalidatePath("/admin/costing"); redirect(`/admin/costing?ok=${ok}`); };

export async function createEquipmentAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("finance.edit"); await createEquipment(fields(fd), u.id); } catch (e) { return { error: toMessage(e) }; }
  done("created");
}
export async function updateEquipmentAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("finance.edit"); await updateEquipment(s(fd, "id"), fields(fd), u.id); } catch (e) { return { error: toMessage(e) }; }
  done("updated");
}
export async function toggleEquipmentAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("finance.edit"); await setEquipmentActive(s(fd, "id"), s(fd, "active") === "1", u.id); } catch (e) { return { error: toMessage(e) }; }
  done(s(fd, "active") === "1" ? "on" : "off");
}
export async function deleteEquipmentAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("finance.edit"); await deleteEquipment(s(fd, "id"), u.id); } catch (e) { return { error: toMessage(e) }; }
  done("deleted");
}
