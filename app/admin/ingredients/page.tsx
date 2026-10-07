import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { getScope } from "@/lib/location";
import { listIngredients } from "@/services/ingredients";
import { fmtQty, bigUnit } from "@/lib/ingredient-units";
import { money } from "@/lib/format";

const OK: Record<string, string> = { created: "Ингредиент добавлен", updated: "Изменения сохранены", deleted: "Ингредиент удалён" };

export default async function IngredientsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("inventory.edit");
  const sp = await searchParams;
  const { locationId } = await getScope();
  const rows = await listIngredients(locationId);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ингредиенты</h1>
          <p className="text-sm text-neutral-500">Из чего готовим: клубника, банан, молоко… Остаток считается по выбранной точке. Затем в «Рецептах» укажите, сколько идёт на порцию, и оформите приход на склад.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/inventory/receive" className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50">+ Приход</Link>
          <Link href="/admin/ingredients/new" className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Новый ингредиент</Link>
        </div>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Ингредиент</th><th>Категория</th><th className="text-right">Остаток</th><th className="text-right">Цена</th><th className="text-right">В рецептах</th><th className="p-3" /></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-10 text-center text-neutral-500">
                <p className="font-medium text-neutral-700">Ингредиентов пока нет</p>
                <p className="mt-1">Добавьте первые: клубника, банан, киви. Потом укажите их в рецептах продуктов.</p>
                <Link href="/admin/ingredients/new" className="mt-4 inline-block rounded-xl bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800">+ Новый ингредиент</Link>
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="relative border-t border-neutral-100 transition-colors hover:bg-green-50/70">
                <td className="p-3 font-medium">
                  <Link href={`/admin/ingredients/${r.id}`} className="after:absolute after:inset-0 after:content-['']">{r.name}</Link>
                </td>
                <td>{r.category}</td>
                <td className="text-right">
                  <span className={r.low ? "font-semibold text-red-700" : ""}>{fmtQty(r.unit, r.stock)}</span>
                  {r.low && <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">мало</span>}
                </td>
                <td className="text-right whitespace-nowrap">{r.price > 0 ? `${money(r.price)} / ${bigUnit(r.unit).label}` : "—"}</td>
                <td className="text-right">{r.recipes || <span className="text-neutral-400">—</span>}</td>
                <td className="p-3 text-right text-green-800">Открыть</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
