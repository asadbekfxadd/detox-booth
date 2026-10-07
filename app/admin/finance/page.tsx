import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { getFinance, EXPENSE_LABEL, REASON_LABEL } from "@/services/finance";
import { parseRange } from "@/services/dashboard";
import { RangeBar } from "@/components/admin/RangeBar";
import { FinanceChart } from "@/components/admin/charts2";
import { HBarChart } from "@/components/admin/charts";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { ActionButton } from "@/components/admin/ActionButton";
import { createExpenseAction, deleteExpenseAction } from "./actions";
import { money, pct, dateStr } from "@/lib/format";
import { tashkentDay } from "@/lib/time";

type SP = { range?: string; from?: string; to?: string; ok?: string };
const OK: Record<string, string> = { created: "Расход добавлен", deleted: "Расход удалён" };
const Kpi = ({ l, v, sub, tone }: { l: string; v: string; sub?: string; tone?: "bad" | "good" }) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-neutral-500">{l}</p>
    <p className={`mt-1 text-xl font-bold ${tone === "bad" ? "text-red-700" : tone === "good" ? "text-green-800" : ""}`}>{v}</p>{sub && <p className="text-xs text-neutral-500">{sub}</p>}</div>
);
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;

export default async function FinancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await pageGuard("finance.view");
  const sp = await searchParams;
  const { locationId, locations, canSwitch } = await getScope();
  const range = parseRange(sp);
  const f = await getFinance(range, locationId);
  const edit = can(user.role, "finance.edit");
  const today = tashkentDay();
  const q = new URLSearchParams({ report: "finance", range: range.key, ...(range.key === "custom" ? { from: sp.from ?? "", to: sp.to ?? "" } : {}) }).toString();
  const row = (label: string, v: number, opts?: { bold?: boolean; minus?: boolean; note?: string }) => (
    <tr className={`border-t border-neutral-100 ${opts?.bold ? "font-bold" : ""}`}>
      <td className="py-2">{label}{opts?.note && <span className="ml-2 text-xs font-normal text-neutral-500">{opts.note}</span>}</td>
      <td className={`py-2 text-right ${v < 0 ? "text-red-700" : ""}`}>{opts?.minus ? "−" : ""}{money(Math.abs(v))}</td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Финансы</h1>
        <a href={`/api/finance/export?${q}`} className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50">Скачать CSV</a>
      </div>
      <RangeBar base="/admin/finance" range={range} />
      {sp.ok && OK[sp.ok] && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      {locationId && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">Выбрана одна точка: общие расходы компании (без привязки к точке) здесь не учитываются. Они видны в режиме «Все точки».</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi l="Выручка" v={money(f.revenue)} sub={`${f.orders} заказов`} />
        <Kpi l="Себестоимость" v={money(f.cogs)} sub={f.revenue ? `${pct((f.cogs / f.revenue) * 100)} от выручки` : undefined} />
        <Kpi l="Валовая прибыль" v={money(f.gross)} sub={`маржа ${pct(f.grossMargin)}`} />
        <Kpi l="Списания" v={money(f.writeOffs)} tone={f.writeOffs ? "bad" : undefined} />
        <Kpi l="Расходы" v={money(f.expenses)} />
        <Kpi l="Чистая прибыль" v={money(f.net)} sub={`маржа ${pct(f.netMargin)}`} tone={f.net < 0 ? "bad" : "good"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Отчёт о прибылях и убытках">
          <table className="w-full text-sm"><tbody>
            {row("Выручка", f.revenue, { bold: true, note: f.delivery ? `включая доставку ${money(f.delivery)}` : undefined })}
            {row("Себестоимость проданного", f.cogs, { minus: true })}
            {row("Валовая прибыль", f.gross, { bold: true })}
            {row("Списания ингредиентов", f.writeOffs, { minus: true })}
            {row("Операционные расходы", f.expenses, { minus: true })}
            {row("Чистая прибыль", f.net, { bold: true })}
          </tbody></table>
          <p className="mt-3 text-xs text-neutral-500">Скидки и оплата баллами ({money(f.discounts)}) уже вычтены из выручки. Возвраты ({f.refundCount} шт., {money(f.refunds)}) в выручку не входят. Налоги не учитываются.</p>
        </Card>
        <Card title="Выручка, прибыль и расходы по дням"><FinanceChart data={f.byDay} /></Card>
        <Card title="Расходы по категориям">
          {f.expensesByCategory.length === 0 ? <p className="text-sm text-neutral-500">За период расходов нет.</p> : <HBarChart data={f.expensesByCategory} dataKey="amount" nameKey="name" />}
        </Card>
        <Card title="Оплата и прочее">
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between"><span>Наличные</span><b>{money(f.payments.CASH)}</b></li>
            <li className="flex justify-between"><span>Карта</span><b>{money(f.payments.CARD)}</b></li>
            <li className="flex justify-between"><span>Онлайн</span><b>{money(f.payments.ONLINE)}</b></li>
            {f.loyaltyLiability != null && <li className="flex justify-between border-t pt-2"><span>Обязательства по баллам клиентов</span><b>{money(f.loyaltyLiability)}</b></li>}
          </ul>
          {f.writeOffsByReason.length > 0 && (
            <div className="mt-4"><p className="mb-1 text-sm font-semibold">Списания по причинам</p>
              <ul className="space-y-1 text-sm">{f.writeOffsByReason.map((w) => <li key={w.reason} className="flex justify-between"><span>{REASON_LABEL[w.reason]}</span><b>{money(w.cost)}</b></li>)}</ul></div>
          )}
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Расходы за период</h2>
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-3">Дата</th><th>Категория</th><th>Точка</th><th>Комментарий</th><th className="text-right">Сумма</th>{edit && <th />}</tr></thead>
            <tbody>
              {f.expenseRows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-neutral-500">Расходов за период нет</td></tr>}
              {f.expenseRows.map((e) => (
                <tr key={e.id} className="border-t border-neutral-100">
                  <td className="p-3 text-neutral-500">{dateStr(e.date)}</td><td>{EXPENSE_LABEL[e.category]}</td><td>{e.location}</td><td className="text-neutral-600">{e.note}</td>
                  <td className="text-right font-semibold">{money(e.amount)}</td>
                  {edit && <td className="p-2 text-right"><ActionButton action={deleteExpenseAction} fields={{ id: e.id }} label="Удалить" danger confirmText="Удалить этот расход? Действие попадёт в журнал." /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {edit && (
        <section className="max-w-xl space-y-3">
          <h2 className="text-lg font-bold">Добавить расход</h2>
          <FormShell action={createExpenseAction} submitLabel="Добавить" cancelHref="/admin/finance">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Категория"><select name="category" required className={fieldClass}>{Object.entries(EXPENSE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Сумма, UZS"><input name="amount" type="number" min="1" step="any" required className={fieldClass} /></Field>
              <Field label="Дата"><input name="date" type="date" defaultValue={today} max={today} required className={fieldClass} /></Field>
              {canSwitch
                ? <Field label="Точка"><select name="locationId" defaultValue={locationId ?? ""} className={fieldClass}><option value="">Общий расход (все точки)</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
                : <input type="hidden" name="locationId" value={user.locationId ?? ""} />}
            </div>
            <Field label="Комментарий"><input name="note" maxLength={200} placeholder="Например: аренда за октябрь" className={fieldClass} /></Field>
          </FormShell>
        </section>
      )}
    </div>
  );
}
