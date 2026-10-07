import { pageGuard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { EmployeeFields } from "@/components/admin/EmployeeFields";
import { assignableRoles, ROLE_LABEL } from "@/services/employees";
import { createEmployeeAction } from "../actions";

export default async function NewEmployeePage() {
  const me = await pageGuard("employees.manage");
  const locations = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const roles = assignableRoles(me.role).map((r) => ({ value: r, label: ROLE_LABEL[r] }));
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Новый сотрудник</h1>
      <FormShell action={createEmployeeAction} submitLabel="Добавить" cancelHref="/admin/employees">
        <EmployeeFields roles={roles} locations={locations} />
        <Field label="Пароль (минимум 8 символов)"><input name="password" type="text" required minLength={8} autoComplete="off" className={fieldClass} /></Field>
        <p className="text-xs text-neutral-500">Передайте пароль сотруднику лично. Позже его можно сменить на странице сотрудника.</p>
      </FormShell>
    </div>
  );
}
