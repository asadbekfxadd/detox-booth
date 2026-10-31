"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { addDailySales, deleteDailySales } from "@/services/revenue-calendar";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const back = (day: string, ok: string) => `/admin/calendar?month=${day.slice(0, 7)}&day=${day}&ok=${ok}#day-panel`;

export async function addDailySalesAction(_p: OpState, fd: FormData): Promise<OpState> {
  const day = s(fd, "day");
  try {
    const u = await requireUser("finance.edit");
    await addDailySales({ day, locationId: s(fd, "locationId"), amount: s(fd, "amount").replace(/\s/g, "").replace(",", "."), method: s(fd, "method"), ordersCount: s(fd, "ordersCount"), note: s(fd, "note") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/calendar");
  redirect(back(day, "added"));
}

export async function deleteDailySalesAction(_p: OpState, fd: FormData): Promise<OpState> {
  let day: string;
  try { const u = await requireUser("finance.edit"); day = await deleteDailySales(s(fd, "id"), u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/calendar");
  redirect(back(day, "deleted"));
}
