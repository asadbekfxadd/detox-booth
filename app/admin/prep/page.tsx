import Link from "next/link";
import { currentSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { listPreps, listActs } from "@/services/prep";
import { fmtQty, bigUnit } from "@/lib/ingredient-units";
import { money, dateTimeStr } from "@/lib/format";

const OK: Record<string, string> = { saved: "Заготовка сохранена", deleted: "Рецепт заготовки удалён" };

/** «Заготовки»: полуфабрикаты (сок-основа, сироп, пюре), которые готовят заранее и потом добавляют в напитки. */
export default async function PrepPage({ searchParams }: { searchParams: Promise<{ ok?: string; n?: string }> }) {
  const sp = await searchParams;
  const user = (await currentSession())!.user;
  const { locationId } = await getScope();
  const [preps, acts] = await Promise.all([listPreps(locationId), listActs(locationId)]);
  const editRecipes = can(user.role, "recipes.edit");
  const cook = can(user.role, "inventory.edit");
  const showCost = can(user.role, "products.cost");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Заготовки</h1>
          <p className="text-sm text-neutral-500">Полуфабрикаты, которые готовят заранее: сок-основа, сироп, пюре. Акт приготовления списывает сырьё и ставит заготовку на склад по честной себестоимости.</p>
        </div>
        {editRecipes && <Link href="/admin/prep/new" className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Новая заготовка</Link>}
      </div>
      {sp.ok === "produced" && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">Акт приготовления №{Number(sp.n)} оформлен: сырьё списано, заготовка на складе</p>}
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Заготовка</th><th className="text-right">Состав</th><th className="text-right">Выход по рецепту</th><th className="text-right">На складе</th>{showCost && <th className="text-right">Себестоимость 1 {"кг/л"}</th>}<th>Готовили</th><th /></tr></thead>
          <tbody>
            {preps.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-neutral-500">Заготовок пока нет. Нажмите «+ Новая заготовка», например «Апельсиновый фреш».</td></tr>}
            {preps.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100">
                <td className="p-3 font-medium"><Link href={`/admin/prep/${p.id}`} className="text-green-800 underline">{p.name}</Link></td>
                <td className="text-right">{p.components} шт.</td>
                <td className="text-right">{fmtQty(p.unit, p.outputQty)}</td>
                <td className="text-right font-semibold">{fmtQty(p.unit, p.stock)}</td>
                {showCost && <td className="text-right">{money((p.avgCost || p.estUnitCost) * bigUnit(p.unit).factor)} <span className="text-xs text-neutral-500">/{bigUnit(p.unit).label}</span></td>}
                <td className="text-neutral-600">{p.lastAt ? dateTimeStr(p.lastAt) : "ещё не готовили"}</td>
                <td className="p-3 text-right">{cook && <Link href={`/admin/prep/${p.id}`} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs hover:bg-neutral-50">Приготовить</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Акты приготовления</h2>
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-3">№</th><th>Дата</th><th>Точка</th><th>Заготовка</th><th className="text-right">Планировали</th><th className="text-right">Получилось</th>{showCost && <th className="text-right">Сырьё</th>}<th className="p-3">Кто</th></tr></thead>
            <tbody>
              {acts.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-neutral-500">Актов ещё не было</td></tr>}
              {acts.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100 align-top">
                  <td className="p-3">{a.number}</td><td>{dateTimeStr(a.at)}</td><td>{a.location}</td>
                  <td className="font-medium">{a.name}
                    <details className="text-xs font-normal text-neutral-600"><summary className="cursor-pointer">Из чего</summary>
                      <ul>{a.items.map((i, k) => <li key={k}>{i.name}: {fmtQty(i.unit, i.quantity)}{showCost ? `, ${money(i.cost)}` : ""}</li>)}</ul>
                      {a.note && <p>Комментарий: {a.note}</p>}
                    </details></td>
                  <td className="text-right">{fmtQty(a.unit, a.planned)}</td>
                  <td className={`text-right font-semibold ${a.actual < a.planned ? "text-amber-700" : ""}`}>{fmtQty(a.unit, a.actual)}</td>
                  {showCost && <td className="text-right">{money(a.cost)}</td>}
                  <td className="p-3">{a.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
