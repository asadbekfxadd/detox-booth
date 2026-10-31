"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { saveSettings, SETTING_FIELDS } from "@/services/settings";
import { saveLocationContacts, createLocation } from "@/services/locations";
import { resetStock } from "@/services/inventory";
import type { OpState } from "@/components/admin/ops";

export async function saveSettingsAction(_p: OpState, fd: FormData): Promise<OpState> {
  let n: number;
  try {
    const u = await requireUser("settings.edit");
    n = await saveSettings(Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, String(fd.get(f.key) ?? "")])), u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/settings"); revalidatePath("/admin/loyalty");
  redirect(`/admin/settings?ok=${n}`);
}

export async function saveLocationsAction(_p: OpState, fd: FormData): Promise<OpState> {
  let n: number;
  try {
    const u = await requireUser("settings.edit");
    const ids = fd.getAll("id").map(String);
    n = await saveLocationContacts(ids.map((id) => ({ id, name: String(fd.get(`name:${id}`) ?? ""), address: String(fd.get(`address:${id}`) ?? ""), phone: String(fd.get(`phone:${id}`) ?? ""), coords: String(fd.get(`coords:${id}`) ?? ""), trackStock: fd.get(`untracked:${id}`) !== "on" })), u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/settings"); revalidatePath("/", "layout");
  redirect(`/admin/settings?loc=${n}`);
}

/** Обнуление остатков перед запуском. Только владелец, с подтверждением словом. */
export async function resetStockAction(_p: OpState, fd: FormData): Promise<OpState> {
  let done: { batches: number; stocks: number };
  try {
    const u = await requireUser("settings.edit");
    const loc = String(fd.get("locationId") ?? "");
    done = await resetStock(loc || null, String(fd.get("confirm") ?? ""), u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin", "layout");
  redirect(`/admin/settings?reset=${done.stocks}`);
}

export async function createLocationAction(_p: OpState, fd: FormData): Promise<OpState> {
  let r: { name: string; manager: boolean };
  try {
    const u = await requireUser("settings.edit");
    const g = (k: string) => String(fd.get(k) ?? "");
    r = await createLocation({ name: g("name"), address: g("address"), phone: g("phone"), coords: g("coords"), trackStock: fd.get("untracked") !== "on", managerName: g("managerName"), managerEmail: g("managerEmail"), managerPassword: g("managerPassword") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/settings"); revalidatePath("/admin/employees"); revalidatePath("/", "layout");
  redirect(`/admin/settings?added=${encodeURIComponent(r.name)}${r.manager ? "&mgr=1" : ""}#locations`);
}
