import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { listCustomers } from "@/services/customers";
import { FilterForm } from "@/components/admin/FilterForm";
import { money, dateStr } from "@/lib/format";

type SP = Record<string, string | undefined>;
const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm";
const qs = (sp: SP, patch: SP) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard("customers.view");
  const sp = await searchParams;
  const r = await listCustomers({ q: sp.q, segment: sp.segment, sort: sp.sort, page: Number(sp.page) || 1 });
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div><h1 className="text-2xl font-bold">Клиенты</h1><p className="text-sm text-neutral-500">Всего по фильтру: {r.total}</p></div>
        <Link href="/admin/loyalty" className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50">Лояльность и промокоды</Link>
      </div>
      <FilterForm key={JSON.stringify(sp)} className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Имя, телефон или email" className={`${input} min-w-60`} />
        <select name="segment" defaultValue={sp.segment ?? ""} className={input}>
          <option value="">Все клиенты</option><option value="orders">С завершёнными заказами</option><option value="new">Без заказов</option><option value="points">С баллами</option>
        </select>
        <select name="sort" defaultValue={sp.sort ?? "new"} className={input}>
          <option value="new">Сначала новые</option><option value="name">По имени</option><option value="points">По баллам</option>
        </select>
        <button className="rounded-lg bg-white px-4 py-2 text-sm shadow-sm hover:bg-neutral-50">Найти</button>
        <Link href="/admin/customers" className="px-2 py-2 text-sm text-neutral-500 underline">Сбросить</Link>
      </FilterForm>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Клиент</th><th>Телефон</th><th className="text-right">Заказов</th><th className="text-right">Потрачено</th><th className="text-right">Баллы</th><th>Последний заказ</th></tr></thead>
          <tbody>
            {r.rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-neutral-500">Клиенты не найдены</td></tr>}
            {r.rows.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="p-3"><Link href={`/admin/customers/${c.id}`} className="font-semibold text-green-800 underline">{c.name}</Link></td>
                <td>{c.phone}</td><td className="text-right">{c.orders}</td><td className="text-right">{money(c.spent)}</td><td className="text-right font-semibold">{c.points}</td>
                <td className="text-neutral-500">{c.last ? dateStr(c.last) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {r.page > 1 && <Link href={`/admin/customers${qs(sp, { page: String(r.page - 1) })}`} className="rounded-lg bg-white px-3 py-1.5 shadow-sm">← Назад</Link>}
          <span>Страница {r.page} из {r.pages}</span>
          {r.page < r.pages && <Link href={`/admin/customers${qs(sp, { page: String(r.page + 1) })}`} className="rounded-lg bg-white px-3 py-1.5 shadow-sm">Вперёд →</Link>}
        </div>
      )}
    </div>
  );
}
