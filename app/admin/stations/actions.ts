"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createStation, updateStation, deleteStation } from "@/services/stations";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const done = (ok: string) => { revalidatePath("/admin/stations"); revalidatePath("/admin/categories"); revalidatePath("/kitchen"); redirect(`/admin/stations?ok=${ok}`); };

export async function createStationAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("products.edit"); await createStation({ name: s(fd, "name"), sort: s(fd, "sort") }, u.id); }
  catch (e) { return { error: toMessage(e) }; }
  done("created");
}
export async function updateStationAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("products.edit"); await updateStation(s(fd, "id"), { name: s(fd, "name"), sort: s(fd, "sort") }, u.id); }
  catch (e) { return { error: toMessage(e) }; }
  done("updated");
}
export async function deleteStationAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("products.edit"); await deleteStation(s(fd, "id"), u.id); }
  catch (e) { return { error: toMessage(e) }; }
  done("deleted");
}
