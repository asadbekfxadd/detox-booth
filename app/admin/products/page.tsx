import { FilterForm } from "@/components/admin/FilterForm";
import Link from "next/link";
import { currentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { money, pct } from "@/lib/format";
import { listProducts } from "@/services/products";
import { RowAction } from "@/components/admin/RowAction";
import { archiveAction, restoreAction, availabilityAction, deleteAction } from "./actions";

type SP = { q?: string; category?: string; status?: string };
const btn = "rounded-lg border border-neutral-200 px-3 py-1 text-xs hover:bg-neutral-50";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = (await currentSession())!.user;
  const showCost = can(user.role, "products.cost");
  const [products, categories] = await Promise.all([
    listProducts({ q: sp.q, categoryId: sp.category, status: sp.status }, showCost),
    prisma.category.findMany({ orderBy: { sort: "asc" } }),
  ]);
  const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Продукты</h1>
        <Link href="/admin/products/new" className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Новый продукт</Link>
      </div>
      <FilterForm key={JSON.stringify(sp)} className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Поиск по названию" className={input} />
        <select name="category" defaultValue={sp.category ?? ""} className={input}>
          <option value="">Все категории</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? "active"} className={input}>
          <option value="active">Активные</option><option value="archived">В архиве</option><option value="all">Все</option>
        </select>
        <button className="rounded-lg bg-white px-4 py-2 text-sm shadow-sm hover:bg-neutral-50">Фильтр</button>
        {(sp.q || sp.category || (sp.status && sp.status !== "active")) && <Link href="/admin/products" className="px-3 py-2 text-sm text-neutral-500 underline">Сбросить</Link>}
      </FilterForm>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500">
            <th className="p-3">Продукт</th><th>Категория</th><th className="text-right">Цена</th>
            {showCost && <><th className="text-right">Себестоимость</th><th className="text-right">Маржа</th></>}
            <th className="text-center">Доступен</th><th className="p-3 text-right">Действия</th>
          </tr></thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-neutral-500">Ничего не найдено</td></tr>}
            {products.map((p) => (
              <tr key={p.id} className={`border-t border-neutral-100 ${p.isArchived ? "opacity-60" : ""}`}>
                <td className="p-3 font-medium">{p.name}{p.isArchived && <span className="ml-2 rounded bg-neutral-100 px-1.5 text-xs">архив</span>}</td>
                <td>{p.category}</td>
                <td className="text-right">{money(p.price)}</td>
                {showCost && <>
                  <td className="text-right">{p.cost == null ? "—" : money(p.cost)}</td>
                  <td className="text-right">{p.cost == null || !p.price ? "—" : pct(((p.price - p.cost) / p.price) * 100)}</td>
                </>}
                <td className="text-center">
                  <RowAction action={availabilityAction.bind(null, p.id, !p.isAvailable)} disabled={p.isArchived} label={p.isAvailable ? "Да" : "Нет"} className={`rounded-full px-3 py-0.5 text-xs font-semibold ${p.isAvailable ? "bg-lime-100 text-green-900" : "bg-neutral-100 text-neutral-500"}`} />
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/products/${p.id}`} className={btn}>Изменить</Link>
                    <RowAction action={(p.isArchived ? restoreAction : archiveAction).bind(null, p.id)} label={p.isArchived ? "Восстановить" : "В архив"} className={btn} />
                    {p.orders === 0 && <RowAction action={deleteAction.bind(null, p.id)} label="Удалить" confirmText="Удалить продукт без возможности восстановления?" className={`${btn} text-red-700`} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
