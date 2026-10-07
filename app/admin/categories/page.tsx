import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { ActionButton } from "@/components/admin/ActionButton";
import { listCategories } from "@/services/categories";
import { deleteCategoryAction } from "./actions";

const OK: Record<string, string> = { created: "Категория добавлена", updated: "Изменения сохранены", deleted: "Категория удалена" };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("products.edit");
  const sp = await searchParams;
  const rows = await listCategories();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Категории</h1>
        <Link href="/admin/categories/new" className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Новая категория</Link>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Название</th><th className="text-right">Порядок</th><th className="text-right">Продуктов</th><th className="p-3 text-right">Действия</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-neutral-500">Категорий пока нет</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="text-right">{c.sort}</td>
                <td className="text-right">{c._count.products}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <Link href={`/admin/categories/${c.id}`} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50">Изменить</Link>
                    {c._count.products === 0 && <ActionButton action={deleteCategoryAction} fields={{ id: c.id }} label="Удалить" danger confirmText={`Удалить категорию «${c.name}»?`} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">Порядок — чем меньше число, тем выше категория в меню и на сайте. Удалить можно только пустую категорию.</p>
    </div>
  );
}
