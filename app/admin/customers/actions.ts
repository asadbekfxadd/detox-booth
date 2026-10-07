"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { updateCustomer, adjustPoints } from "@/services/customers";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function updateCustomerAction(_p: OpState, fd: FormData): Promise<OpState> {
  const id = s(fd, "id");
  try {
    const u = await requireUser("customers.manage");
    await updateCustomer({ id, name: s(fd, "name"), phone: s(fd, "phone"), email: s(fd, "email"), birthday: s(fd, "birthday"), referrerPhone: s(fd, "referrerPhone") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/customers");
  redirect(`/admin/customers/${id}?ok=saved`);
}

export async function adjustPointsAction(_p: OpState, fd: FormData): Promise<OpState> {
  const id = s(fd, "id");
  try {
    const u = await requireUser("customers.manage");
    await adjustPoints({ id, delta: s(fd, "delta"), type: s(fd, "type"), note: s(fd, "note") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/customers"); revalidatePath("/admin/loyalty");
  redirect(`/admin/customers/${id}?ok=points`);
}
