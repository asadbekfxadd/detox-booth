import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getCosting } from "@/services/costing";
import { EXPENSE_LABEL } from "@/services/finance";
import { money, num, pct } from "@/lib/format";

const OK: Record<string, string> = { created: "Оборудование добавлено", updated: "Изменения сохранены", on: "Оборудование включено в калькуляцию", off: "Оборудование выключено из калькуляции", deleted: "Оборудование удалено" };

/** Части себестоимости: цвет в полосе и в легенде совпадает. */
const PARTS = [
  { key: "ingredients", label: "Ингредиенты", color: "bg-green-600" },
  { key: "packaging", label: "Упаковка", color: "bg-sky-500" },
  { key: "loss", label: "Потери", color: "bg-amber-500" },
  { key: "amortization", label: "Амортизация", color: "bg-violet-500" },
  { key: "labor", label: "Зарплата", color: "bg-rose-500" },
  { key: "overhead", label: "Накладные", color: "bg-slate-500" },
] as const;

const Kpi = ({ l, v, sub }: { l: string; v: string; sub?: string }) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-neutral-500">{l}</p><p className="mt-1 text-xl font-bold">{v}</p>{sub && <p className="text-xs text-neutral-500">{sub}</p>}</div>
);

export default async function CostingPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await pageGuard("finance.view");
  const sp = await searchParams;
  const c = await getCosting();
  const edit = can(user.role, "finance.edit");
  const settings = can(user.role, "settings.edit");
  const noRecipe = c.rows.filter((r) => !r.hasRecipe).length;
  const laborTotal = c.salaryMonthly * (1 + c.payrollTaxPct / 100);
  const expenseTotal = laborTotal + c.overheadMonthly;
  const perDrink = (v: number) => (c.basis.value > 0 ? money(v / c.basis.value) : "—");
  const costed = c.rows.filter((r) => r.hasRecipe);
  const avgMargin = costed.length ? costed.reduce((a, r) => a + (r.marginPct ?? 0), 0) / costed.length : null;
  const settingsLink = settings ? <Link href="/admin/settings" className="underline">Настройки → Калькуляция</Link> : "Настройки → Калькуляция";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Калькуляция</h1>
          <p className="text-sm text-neutral-500">Полная себестоимость одного напитка: ингредиенты, стаканчик, амортизация оборудования, зарплата и аренда.</p>
        </div>
        {settings && <Link href="/admin/settings" className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50">Настройки калькуляции</Link>}
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}

      <div className="space-y-2">
        {c.basis.source === "none" && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">Продаж за 30 дней ещё нет, поэтому зарплата и аренда не разложены по напиткам. Укажите плановое число напитков в месяц: {settingsLink}.</p>}
        {c.salaryCount === 0 && !c.salaryFromExpenses && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">Окладов нет, зарплата в себестоимость не входит. Оклад указывается в карточке сотрудника (Бизнес → Сотрудники).</p>}
        {c.equipment.filter((e) => e.isActive).length === 0 && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">Оборудования нет, амортизация не учтена. Добавьте выжималки и блендеры ниже.</p>}
        {noRecipe > 0 && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">У {noRecipe} из {c.rows.length} позиций нет рецепта, их прибыль не посчитана. Заполните рецепты в разделе «Рецепты».</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi l="Напитков в месяц в расчёте" v={num(c.basis.value)} sub={c.basis.source === "plan" ? "плановое число" : c.basis.source === "fact" ? `факт за 30 дней` : "нет данных"} />
        <Kpi l="Зарплата на напиток" v={money(c.shares.labor)} sub={c.salaryFromExpenses ? `${money(c.salaryMonthly)} в месяц, из расходов` : `фонд ${money(c.salaryMonthly * (1 + c.payrollTaxPct / 100))} · ${c.salaryCount} сотр.`} />
        <Kpi l="Аренда и прочие расходы на напиток" v={money(c.shares.overhead)} sub={`${money(c.overheadMonthly)} в месяц${c.overheadManual ? "" : ", из расходов"}`} />
        <Kpi l="Средняя маржа" v={avgMargin == null ? "—" : pct(avgMargin)} sub={`по ${costed.length} позициям с рецептом`} />
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Расходы в месяц</h2>
        <p className="mb-3 text-xs text-neutral-500">Всё, что бизнес тратит в месяц помимо ингредиентов. Эти суммы делятся на число напитков в месяц и попадают в себестоимость.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-neutral-500"><th className="py-2">Статья</th><th className="text-right">В месяц</th><th className="text-right">На напиток</th><th className="pl-4">Откуда</th></tr></thead>
            <tbody>
              <tr className="border-t border-neutral-100"><td className="py-2 font-medium">Зарплата{c.payrollTaxPct > 0 && !c.salaryFromExpenses ? ` (+${c.payrollTaxPct}% взносов)` : ""}</td><td className="text-right">{money(laborTotal)}</td><td className="text-right">{perDrink(laborTotal)}</td>
                <td className="pl-4 text-xs text-neutral-500">{c.salaryFromExpenses ? "расход «Зарплата» из «Финансов»" : c.salaryCount ? `оклады, ${c.salaryCount} сотр.` : "не заполнено"}</td></tr>
              {c.overheadManual
                ? <tr className="border-t border-neutral-100"><td className="py-2 font-medium">Аренда и прочие расходы</td><td className="text-right">{money(c.overheadMonthly)}</td><td className="text-right">{perDrink(c.overheadMonthly)}</td><td className="pl-4 text-xs text-neutral-500">сумма из Настроек</td></tr>
                : Object.entries(c.expenses).filter(([k]) => k !== "SALARY").sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <tr key={k} className="border-t border-neutral-100"><td className="py-2 font-medium">{EXPENSE_LABEL[k] ?? k}</td><td className="text-right">{money(v)}</td><td className="text-right">{perDrink(v)}</td><td className="pl-4 text-xs text-neutral-500">расходы в «Финансах», среднее за 90 дней</td></tr>
                ))}
              {!c.overheadManual && c.overheadMonthly === 0 && <tr className="border-t border-neutral-100"><td colSpan={4} className="py-3 text-neutral-500">Аренды и других расходов пока нет. Внесите их в «Финансы → Расходы» или укажите сумму в {settings ? <Link href="/admin/settings" className="underline">Настройках</Link> : "Настройках"}.</td></tr>}
              <tr className="border-t border-neutral-200 font-bold"><td className="py-2">Итого</td><td className="text-right">{money(expenseTotal)}</td><td className="text-right">{perDrink(expenseTotal)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="font-semibold">Себестоимость напитков, UZS</h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600">
            {PARTS.map((p) => <li key={p.key} className="flex items-center gap-1.5"><span className={`inline-block h-2.5 w-2.5 rounded-sm ${p.color}`} />{p.label}</li>)}
          </ul>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm [&_td]:px-2 [&_th]:px-2 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead><tr className="text-left text-xs text-neutral-500">
              <th className="py-2 pr-3">Напиток</th><th className="text-right">Цена</th><th className="text-right">Ингред.</th><th className="text-right">Упаковка</th><th className="text-right">Потери</th>
              <th className="text-right">Амортиз.</th><th className="text-right">Зарплата</th><th className="text-right">Накладные</th><th className="text-right font-semibold text-neutral-700">Себестоимость</th>
              <th className="text-right">Прибыль</th><th className="text-right">Маржа</th><th className="w-40 pl-4">Состав</th>
            </tr></thead>
            <tbody>
              {c.rows.length === 0 && <tr><td colSpan={12} className="p-8 text-center text-neutral-500">Продуктов пока нет</td></tr>}
              {c.rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="!whitespace-normal py-2 pr-3"><span className="font-medium">{r.name}</span><span className="block text-xs text-neutral-500">{r.category}</span></td>
                  <td className="text-right">{num(r.price)}</td>
                  <td className="text-right">{r.hasRecipe ? num(r.ingredients) : <span className="text-xs text-neutral-400">нет рецепта</span>}</td>
                  <td className="text-right">{num(r.packaging)}</td><td className="text-right">{num(r.loss)}</td>
                  <td className="text-right" title={r.equipment.map((e) => `${e.name}: ${num(e.perDrink)}`).join("\n")}>{num(r.amortization)}</td>
                  <td className="text-right">{num(r.labor)}</td><td className="text-right">{num(r.overhead)}</td>
                  <td className="text-right font-bold" title={r.hasRecipe ? undefined : "Без рецепта себестоимость неполная"}>{r.hasRecipe ? num(r.total) : <span className="font-normal text-neutral-400">—</span>}</td>
                  <td className={`text-right ${r.profit != null && r.profit < 0 ? "text-red-700" : ""}`}>{r.profit == null ? "—" : num(r.profit)}</td>
                  <td className={`text-right font-semibold ${r.marginPct == null ? "" : r.marginPct < 0 ? "text-red-700" : r.marginPct < 30 ? "text-amber-700" : "text-green-800"}`}>{r.marginPct == null ? "—" : pct(r.marginPct)}</td>
                  <td className="pl-4">
                    {r.hasRecipe && r.total > 0 && (
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100" role="img" aria-label={PARTS.map((p) => `${p.label} ${num(r[p.key])}`).join(", ")}>
                        {PARTS.map((p) => r[p.key] > 0 && <span key={p.key} className={p.color} style={{ width: `${(r[p.key] / r.total) * 100}%` }} />)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Ингредиенты считаются по средней закупочной цене. Упаковка — ингредиенты категории «Packaging» или «Упаковка» из рецепта плюс сумма на напиток из настроек.
          Зарплата и расходы месяца делятся на число напитков в месяц. Маржа ниже 30% выделена жёлтым, отрицательная — красным.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Оборудование и амортизация</h2><p className="text-xs text-neutral-500">Цена ÷ ресурс в напитках = сколько оборудование добавляет к каждому напитку.</p></div>
          {edit && <Link href="/admin/costing/equipment/new" className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Оборудование</Link>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-neutral-500"><th className="py-2">Оборудование</th><th>Для напитков</th><th className="text-right">Цена</th><th className="text-right">Ресурс, напитков</th><th className="text-right">На напиток</th><th className="py-2" /></tr></thead>
            <tbody>
              {c.equipment.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-500">Оборудования пока нет. Добавьте выжималки, блендеры, холодильник — их амортизация попадёт в себестоимость.</td></tr>}
              {c.equipment.map((e) => (
                <tr key={e.id} className={`border-t border-neutral-100 ${e.isActive ? "" : "text-neutral-400"}`}>
                  <td className="py-2 font-medium">{e.name}{!e.isActive && <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-normal">выключено</span>}</td>
                  <td>{e.category ?? "Все напитки"}</td>
                  <td className="text-right">{money(e.price)}</td><td className="text-right">{num(e.lifeDrinks)}</td><td className="text-right font-semibold">{money(e.perDrink)}</td>
                  <td className="py-2 text-right">{edit && <Link href={`/admin/costing/equipment/${e.id}`} className="text-green-800 underline">Открыть</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
