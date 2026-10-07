"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createEmployee, updateEmployee, setEmployeeActive, resetPassword } from "@/services/employees";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const fields = (fd: FormData) => ({ name: s(fd, "name"), email: s(fd, "email"), role: s(fd, "role"), locationId: s(fd, "locationId") });

export async function createEmployeeAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("employees.manage"); await createEmployee(u, { ...fields(fd), password: s(fd, "password") }); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/employees");
  redirect("/admin/employees?ok=created");
}

export async function updateEmployeeAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("employees.manage"); await updateEmployee(u, s(fd, "id"), fields(fd)); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/employees");
  redirect("/admin/employees?ok=updated");
}

export async function toggleActiveAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("employees.manage"); await setEmployeeActive(u, s(fd, "id"), s(fd, "active") === "1"); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/employees");
  redirect(`/admin/employees?ok=${s(fd, "active") === "1" ? "activated" : "deactivated"}`);
}

export async function resetPasswordAction(_p: OpState, fd: FormData): Promise<OpState> {
  try { const u = await requireUser("employees.manage"); await resetPassword(u, s(fd, "id"), s(fd, "password")); }
  catch (e) { return { error: toMessage(e) }; }
  redirect("/admin/employees?ok=password");
}
