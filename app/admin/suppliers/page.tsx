import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { listSuppliers } from "@/services/suppliers";

const OK: Record<string, string> = { created: "Поставщик добавлен", updated: "Изменения сохранены", deleted: "Поставщик удалён" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("purchases.manage");
  const sp = await searchParams;
  const rows = await listSuppliers();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Поставщики</h1>
        <Link href="/admin/suppliers/new" className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Новый поставщик</Link>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Поставщик</th><th>Телефон</th><th className="text-right">Ингредиентов</th><th className="text-right">Закупок</th><th className="p-3" /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-neutral-500">Поставщиков пока нет</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="p-3 font-medium">{s.name}</td><td>{s.phone || "—"}</td>
                <td className="text-right">{s.ingredients}</td><td className="text-right">{s.purchases}</td>
                <td className="p-3 text-right"><Link href={`/admin/suppliers/${s.id}`} className="text-green-800 underline">Открыть</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
