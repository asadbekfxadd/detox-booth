import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { ActionButton } from "@/components/admin/ActionButton";
import { listEmployees, ROLE_LABEL } from "@/services/employees";
import { toggleActiveAction } from "./actions";

const OK: Record<string, string> = {
  created: "Сотрудник добавлен", updated: "Изменения сохранены", activated: "Сотрудник снова активен",
  deactivated: "Сотрудник отключён — доступ закрыт сразу", password: "Пароль изменён",
};

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const me = await pageGuard("employees.manage");
  const sp = await searchParams;
  const rows = await listEmployees();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Сотрудники</h1>
        <Link href="/admin/employees/new" className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Новый сотрудник</Link>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Сотрудник</th><th>Роль</th><th>Точка</th><th>Статус</th><th className="p-3 text-right">Действия</th></tr></thead>
          <tbody>
            {rows.map((u) => {
              const locked = me.role !== "OWNER" && (u.role === "OWNER" || u.role === "ADMIN");
              return (
                <tr key={u.id} className={`border-t border-neutral-100 ${u.isActive ? "" : "opacity-60"}`}>
                  <td className="p-3"><p className="font-medium">{u.name}{u.id === me.id && <span className="ml-2 rounded bg-neutral-100 px-1.5 text-xs">это вы</span>}</p><p className="text-xs text-neutral-500">{u.email}</p></td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{u.location?.name ?? "Все точки"}</td>
                  <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.isActive ? "bg-lime-100 text-green-900" : "bg-neutral-100 text-neutral-500"}`}>{u.isActive ? "Активен" : "Отключён"}</span></td>
                  <td className="p-3">
                    {locked ? <span className="block text-right text-xs text-neutral-400">только владелец</span> : (
                      <div className="flex flex-wrap items-start justify-end gap-2">
                        <Link href={`/admin/employees/${u.id}`} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50">Изменить</Link>
                        {u.id !== me.id && (
                          <ActionButton action={toggleActiveAction} fields={{ id: u.id, active: u.isActive ? "0" : "1" }} label={u.isActive ? "Отключить" : "Включить"} danger={u.isActive}
                            confirmText={u.isActive ? `Отключить доступ сотрудника «${u.name}»?` : undefined} />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">Отключённый сотрудник теряет доступ сразу. История его заказов и действий сохраняется.</p>
    </div>
  );
}
