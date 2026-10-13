"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createHappyHour, setHappyActive, deleteHappyHour } from "@/services/happy-hour";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const done = (ok: string) => { revalidatePath("/admin/happy-hour"); revalidatePath("/menu"); revalidatePath("/"); redirect(`/admin/happy-hour?ok=${ok}`); };

export async function createHappyAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("settings.edit");
    await createHappyHour({ name: s(fd, "name"), percent: s(fd, "percent"), days: fd.getAll("days").map(String), start: s(fd, "start"), end: s(fd, "end"), categoryId: s(fd, "categoryId") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  done("created");
}
export async function toggleHappyAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await setHappyActive(s(fd, "id"), s(fd, "active") === "1", u); }
  catch (e) { return { error: toMessage(e) }; }
  done("toggled");
}
export async function deleteHappyAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("settings.edit"); await deleteHappyHour(s(fd, "id"), u); }
  catch (e) { return { error: toMessage(e) }; }
  done("deleted");
}
