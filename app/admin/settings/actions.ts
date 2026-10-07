"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { saveSettings, SETTING_FIELDS } from "@/services/settings";
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
