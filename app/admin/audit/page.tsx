import Link from "next/link";
import { FilterForm } from "@/components/admin/FilterForm";
import { pageGuard } from "@/lib/guard";
import { dateTimeStr } from "@/lib/format";
import { actionLabel } from "@/lib/audit-labels";
import { listAudit } from "@/services/audit-log";

type SP = { user?: string; action?: string; q?: string; from?: string; to?: string; page?: string };
const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm";
const qs = (sp: SP, patch: SP) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v); const s = p.toString(); return s ? `?${s}` : ""; };

// В журнал не должны попадать пароли и хэши, но на всякий случай скрываем такие поля
const SECRET = /pass|hash|secret|token/i;
const clean = (v: unknown): unknown => v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SECRET.test(k) ? "***" : x])) : v;
const pretty = (v: unknown) => JSON.stringify(clean(v), null, 1);

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard("audit.view");
  const sp = await searchParams;
  const r = await listAudit({ userId: sp.user, action: sp.action, q: sp.q, from: sp.from, to: sp.to, page: Number(sp.page) || 1 });
  const filtered = !!(sp.user || sp.action || sp.q || sp.from || sp.to);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Журнал действий</h1>
      <FilterForm key={JSON.stringify(sp)} className="flex flex-wrap items-center gap-2">
        <select name="user" defaultValue={sp.user ?? ""} className={input}>
          <option value="">Все сотрудники</option>
          {r.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select name="action" defaultValue={sp.action ?? ""} className={input}>
          <option value="">Все действия</option>
          {r.actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
        </select>
        <input type="date" name="from" defaultValue={sp.from} className={input} aria-label="С даты" />
        <input type="date" name="to" defaultValue={sp.to} className={input} aria-label="По дату" />
        <input name="q" defaultValue={sp.q} placeholder="ID записи или объект" className={input} />
        <button className="rounded-lg bg-white px-4 py-2 text-sm shadow-sm hover:bg-neutral-50">Найти</button>
        {filtered && <Link href="/admin/audit" className="px-3 py-2 text-sm text-neutral-500 underline">Сбросить</Link>}
      </FilterForm>
      <p className="text-sm text-neutral-500">Записей: {r.count}</p>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Время</th><th>Сотрудник</th><th>Действие</th><th>Объект</th><th className="p-3">Детали</th></tr></thead>
          <tbody>
            {r.rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-neutral-500">Ничего не найдено</td></tr>}
            {r.rows.map((a) => (
              <tr key={a.id} className="border-t border-neutral-100 align-top">
                <td className="whitespace-nowrap p-3 text-neutral-600">{dateTimeStr(a.createdAt)}</td>
                <td>{a.user?.name ?? <span className="text-neutral-400">система / гость</span>}</td>
                <td className="font-medium">{actionLabel(a.action)}</td>
                <td className="text-neutral-600">{a.entity}{a.entityId && <span className="ml-1 text-xs text-neutral-400">{a.entityId.slice(-8)}</span>}</td>
                <td className="p-3">
                  {a.oldValue == null && a.newValue == null ? <span className="text-neutral-300">—</span> : (
                    <details>
                      <summary className="cursor-pointer text-green-800 underline">Показать</summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {a.oldValue != null && <div><p className="text-xs text-neutral-500">Было</p><pre className="max-h-48 overflow-auto rounded bg-neutral-50 p-2 text-xs">{pretty(a.oldValue)}</pre></div>}
                        {a.newValue != null && <div><p className="text-xs text-neutral-500">Стало</p><pre className="max-h-48 overflow-auto rounded bg-neutral-50 p-2 text-xs">{pretty(a.newValue)}</pre></div>}
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {r.page > 1 && <Link href={`/admin/audit${qs(sp, { page: String(r.page - 1) })}`} className="rounded-lg bg-white px-4 py-2 shadow-sm">← Назад</Link>}
          <span>Страница {r.page} из {r.pages}</span>
          {r.page < r.pages && <Link href={`/admin/audit${qs(sp, { page: String(r.page + 1) })}`} className="rounded-lg bg-white px-4 py-2 shadow-sm">Дальше →</Link>}
        </div>
      )}
    </div>
  );
}
