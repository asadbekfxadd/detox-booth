"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createExpense, deleteExpense } from "@/services/finance";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createExpenseAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("finance.edit");
    await createExpense({ category: s(fd, "category"), amount: s(fd, "amount").replace(",", "."), date: s(fd, "date"), note: s(fd, "note"), locationId: s(fd, "locationId") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/finance");
  redirect("/admin/finance?range=30&ok=created");
}

export async function deleteExpenseAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("finance.edit"); await deleteExpense(s(fd, "id"), u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/finance");
  redirect("/admin/finance?range=30&ok=deleted");
}
