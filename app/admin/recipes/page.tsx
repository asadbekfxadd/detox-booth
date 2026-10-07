import Link from "next/link";
import { currentSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { money, pct, num } from "@/lib/format";
import { listRecipes } from "@/services/recipes";

export default async function RecipesPage() {
  const user = (await currentSession())!.user;
  const { locationId } = await getScope();
  const showCost = can(user.role, "products.cost");
  const rows = await listRecipes(locationId, showCost);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Рецепты</h1>
        <p className="text-sm text-neutral-500">Технологические карты. При каждой продаже ингредиенты списываются со склада по этим рецептам. «Порций» считается по остаткам выбранной точки. Нужного ингредиента нет? Добавьте его в разделе <Link href="/admin/ingredients" className="text-green-800 underline">«Ингредиенты»</Link> или прямо в рецепте.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500">
            <th className="p-3">Продукт</th><th>Категория</th><th className="text-right">Ингредиентов</th>
            {showCost && <><th className="text-right">Себестоимость</th><th className="text-right">Маржа</th></>}
            <th className="text-right">Порций на складе</th><th className="p-3" />
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="p-3 font-medium">{r.name}</td>
                <td>{r.category}</td>
                <td className="text-right">{r.hasRecipe ? num(r.ingredients) : <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">нет рецепта</span>}</td>
                {showCost && <>
                  <td className="text-right">{r.cost == null ? "—" : money(r.cost)}</td>
                  <td className="text-right">{r.cost == null || !r.price ? "—" : pct(((r.price - r.cost) / r.price) * 100)}</td>
                </>}
                <td className={`text-right ${r.portions === 0 ? "font-semibold text-red-700" : ""}`}>{r.portions == null ? "—" : num(r.portions)}</td>
                <td className="p-3 text-right"><Link href={`/admin/recipes/${r.id}`} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs hover:bg-neutral-50">{r.hasRecipe ? "Изменить" : "Создать"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
