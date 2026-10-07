import { notFound, redirect } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { EmployeeFields } from "@/components/admin/EmployeeFields";
import { assignableRoles, getEmployee, ROLE_LABEL } from "@/services/employees";
import { updateEmployeeAction, resetPasswordAction } from "../actions";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await pageGuard("employees.manage");
  const { id } = await params;
  const u = await getEmployee(id);
  if (!u) notFound();
  if (me.role !== "OWNER" && (u.role === "OWNER" || u.role === "ADMIN")) redirect("/forbidden");
  const locations = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const roles = assignableRoles(me.role).map((r) => ({ value: r, label: ROLE_LABEL[r] }));
  const selfLocked = u.id === me.id; // свою роль менять нельзя
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">{u.name}</h1>
      <FormShell action={updateEmployeeAction} submitLabel="Сохранить" cancelHref="/admin/employees">
        <input type="hidden" name="id" value={u.id} />
        <EmployeeFields roles={selfLocked ? [{ value: u.role, label: ROLE_LABEL[u.role] }] : roles} locations={locations} v={u} />
      </FormShell>
      <FormShell action={resetPasswordAction} submitLabel="Сменить пароль" cancelHref="/admin/employees">
        <input type="hidden" name="id" value={u.id} />
        <h2 className="font-semibold">Новый пароль</h2>
        <Field label="Пароль (минимум 8 символов)"><input name="password" type="text" required minLength={8} autoComplete="off" className={fieldClass} /></Field>
      </FormShell>
    </div>
  );
}
