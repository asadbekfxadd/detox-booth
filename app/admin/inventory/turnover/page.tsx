import Link from "next/link";
import { currentSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { getTurnover } from "@/services/turnover";
import { periodBounds, todayTashkent, monthStartTashkent } from "@/lib/turnover";
import { fmtStock } from "@/lib/ingredient-units";
import { money } from "@/lib/format";

/**
 * Оборотная ведомость: по каждому продукту остаток на начало периода, приход, расход и остаток на конец.
 * «Остаток на дату» — тот же отчёт за один день: смотрите колонку «На конец».
 */
export default async function TurnoverPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; all?: string }> }) {
  const sp = await searchParams;
  const user = (await currentSession())!.user;
  const { locationId } = await getScope();
  const from = sp.from ?? monthStartTashkent();
  const to = sp.to ?? todayTashkent();
  const bounds = periodBounds(from, to);
  const lines = bounds ? await getTurnover(locationId, bounds.from, bounds.to, { includeEmpty: sp.all === "1" }) : [];
  const showCost = can(user.role, "products.cost");
  const totalOpen = lines.reduce((a, l) => a + l.openingValue, 0);
  const totalClose = lines.reduce((a, l) => a + l.closingValue, 0);
  const f = fmtStock;
  const cell = "px-2 text-right whitespace-nowrap";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Оборотная ведомость</h1>
        <p className="text-sm text-neutral-500">Что было на складе в начале периода, сколько пришло, ушло и что осталось. Нужен остаток на конкретную дату: поставьте её в оба поля и смотрите «На конец».</p>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">С</span><input type="date" name="from" defaultValue={from} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" /></label>
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">По (включительно)</span><input type="date" name="to" defaultValue={to} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" /></label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="all" value="1" defaultChecked={sp.all === "1"} /> Показать и пустые строки</label>
        <button className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">Показать</button>
        {bounds && lines.length > 0 && <a href={`/admin/inventory/turnover/csv?from=${from}&to=${to}${sp.all === "1" ? "&all=1" : ""}`} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50">Скачать для Excel (CSV)</a>}
        <Link href="/admin/inventory" className="ml-auto text-sm text-green-800 underline">← К складу</Link>
      </form>
      {!bounds && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">Проверьте даты: «С» не может быть позже «По».</p>}
      {bounds && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-neutral-500">
              <th className="p-3">Продукт</th><th className="px-2 text-right">На начало</th><th className="px-2 text-right">Приход</th><th className="px-2 text-right" title="Заготовка получена по акту приготовления">Из заготовок</th>
              <th className="px-2 text-right">Продажи</th><th className="px-2 text-right">Списания</th><th className="px-2 text-right" title="Ушло в заготовки по акту приготовления">В заготовки</th><th className="px-2 text-right">Перемещено</th><th className="px-2 text-right" title="Инвентаризация и ручные поправки">Поправки</th><th className="px-2 text-right">На конец</th>
              {showCost && <th className="px-2 text-right p-3">Сумма на конец</th>}
            </tr></thead>
            <tbody>
              {lines.length === 0 && <tr><td colSpan={11} className="p-8 text-center text-neutral-500">За этот период движений нет</td></tr>}
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-neutral-100">
                  <td className="p-3 font-medium">{l.name}</td>
                  <td className={cell}>{f(l.unit, l.opening)}</td>
                  <td className={`${cell} ${l.receipts ? "text-green-700" : "text-neutral-400"}`}>{l.receipts ? `+${f(l.unit, l.receipts)}` : "—"}</td>
                  <td className={`${cell} ${l.prodIn ? "text-green-700" : "text-neutral-400"}`}>{l.prodIn ? `+${f(l.unit, l.prodIn)}` : "—"}</td>
                  <td className={`${cell} ${l.sales ? "" : "text-neutral-400"}`}>{l.sales ? `−${f(l.unit, l.sales)}` : "—"}</td>
                  <td className={`${cell} ${l.writeOffs ? "text-red-700" : "text-neutral-400"}`}>{l.writeOffs ? `−${f(l.unit, l.writeOffs)}` : "—"}</td>
                  <td className={`${cell} ${l.prodOut ? "" : "text-neutral-400"}`}>{l.prodOut ? `−${f(l.unit, l.prodOut)}` : "—"}</td>
                  <td className={`${cell} ${l.transferOut ? "" : "text-neutral-400"}`}>{l.transferOut ? `−${f(l.unit, l.transferOut)}` : "—"}</td>
                  <td className={`${cell} ${l.adjust < 0 ? "text-red-700" : l.adjust > 0 ? "text-green-700" : "text-neutral-400"}`}>{l.adjust ? `${l.adjust > 0 ? "+" : "−"}${f(l.unit, Math.abs(l.adjust))}` : "—"}</td>
                  <td className={`${cell} font-semibold`}>{f(l.unit, l.closing)}</td>
                  {showCost && <td className={`${cell} p-3`}>{money(l.closingValue)}</td>}
                </tr>
              ))}
            </tbody>
            {showCost && lines.length > 0 && (
              <tfoot><tr className="border-t-2 border-neutral-200 font-semibold"><td className="p-3" colSpan={9}>Итого: на начало {money(totalOpen)}</td><td /><td className="p-3 text-right">{money(totalClose)}</td></tr></tfoot>
            )}
          </table>
        </div>
      )}
      <p className="text-xs text-neutral-500">Остатки считаются от текущего склада назад по журналу движений. Суммы по средней закупочной цене. «Продажи» уменьшены на возвраты при отмене заказов.</p>
    </div>
  );
}
