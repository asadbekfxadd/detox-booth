"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { addTable, setTableActive, resetTableToken } from "@/services/tables";

const done = (msg: string, err = false): never => { revalidatePath("/admin/tables"); redirect(`/admin/tables?${err ? "error" : "ok"}=${encodeURIComponent(msg)}`); };

export async function addTableAction(fd: FormData): Promise<void> {
  try { const u = await requireUser("settings.edit"); const t = await addTable(String(fd.get("locationId") ?? ""), u); done(`Добавлен стол ${t.number}`); }
  catch (e) { if (isRedirect(e)) throw e; done(toMessage(e), true); }
}
export async function toggleTableAction(fd: FormData): Promise<void> {
  try { const u = await requireUser("settings.edit"); await setTableActive(String(fd.get("id") ?? ""), fd.get("active") === "1", u); done("Сохранено"); }
  catch (e) { if (isRedirect(e)) throw e; done(toMessage(e), true); }
}
export async function resetTokenAction(fd: FormData): Promise<void> {
  try { const u = await requireUser("settings.edit"); await resetTableToken(String(fd.get("id") ?? ""), u); done("QR перевыпущен. Старая наклейка больше не работает, распечатайте новую."); }
  catch (e) { if (isRedirect(e)) throw e; done(toMessage(e), true); }
}

/** redirect() в Next бросает специальную ошибку; её нельзя глотать в catch. */
function isRedirect(e: unknown) { return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT"); }
