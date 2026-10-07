import { Field, fieldClass } from "@/components/admin/ops";

/** Общие поля формы сотрудника. Точка нужна всем ролям, кроме владельца и бухгалтера. */
export function EmployeeFields({ roles, locations, v }: {
  roles: { value: string; label: string }[]; locations: { id: string; name: string }[];
  v?: { name?: string; email?: string; role?: string; locationId?: string | null };
}) {
  return (
    <>
      <Field label="Имя"><input name="name" required defaultValue={v?.name} className={fieldClass} /></Field>
      {v?.email !== undefined
        ? <div className="text-sm"><span className="mb-1 block text-neutral-600">Email (логин)</span><p className="py-2 font-medium">{v.email}</p></div>
        : <Field label="Email (логин)"><input name="email" type="email" required className={fieldClass} /></Field>}
      <Field label="Роль">
        <select name="role" required defaultValue={v?.role ?? "CASHIER"} className={fieldClass}>
          {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Field>
      <Field label="Точка (для владельца и бухгалтера не нужна)">
        <select name="locationId" defaultValue={v?.locationId ?? ""} className={fieldClass}>
          <option value="">— без привязки —</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
    </>
  );
}
