import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { tashkentDay } from "@/lib/time";
import { money } from "@/lib/format";
import { getMonth, getDay } from "@/services/revenue-calendar";
import { MONTHS, WEEKDAYS, dayTitle, isDay, isMonth, monthGrid, shiftMonth, shortMoney } from "@/lib/revenue-calendar";
import { FormShell, Field, LocationField, fieldClass } from "@/components/admin/ops";
import { ActionButton } from "@/components/admin/ActionButton";
import { addDailySalesAction, deleteDailySalesAction } from "./actions";

type SP = { month?: string; day?: string; ok?: string };
const OK: Record<string, string> = { added: "Продажи внесены", deleted: "Запись удалена" };
const METHOD: Record<string, string> = { CASH: "Наличные", CARD: "Карта", ONLINE: "Онлайн" };
const Kpi = ({ l, v, sub }: { l: string; v: string; sub?: string }) => <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-neutral-500">{l}</p><p className="mt-1 text-xl font-bold">{v}</p>{sub && <p className="text-xs text-neutral-500">{sub}</p>}</div>;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await pageGuard("finance.view");
  const sp = await searchParams;
  const today = tashkentDay();
  const day = isDay(sp.day) ? sp.day : null;
  const ym = isMonth(sp.month) ? sp.month : day ? day.slice(0, 7) : today.slice(0, 7);
  const { locationId, locations } = await getScope();
  const edit = can(user.role, "finance.edit");
  const [month, detail] = await Promise.all([getMonth(ym, locationId), day && day.slice(0, 7) === ym ? getDay(day, locationId) : Promise.resolve(null)]);
  const max = Math.max(1, ...[...month.days.values()].map((d) => d.system + d.manual));
  const options = (locationId ? locations.filter((l) => l.id === locationId) : locations).map((l) => ({ id: l.id, name: l.name }));
  const href = (m: string, d?: string) => `/admin/calendar?month=${m}${d ? `&day=${d}` : ""}${d ? "#day-panel" : ""}`;
  const [y, mm] = [ym.slice(0, 4), Number(ym.slice(5, 7))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Календарь выручки</h1>
        <div className="flex items-center gap-2">
          <Link href={href(shiftMonth(ym, -1))} aria-label="Предыдущий месяц" className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50">←</Link>
          <span className="min-w-36 text-center font-semibold capitalize">{MONTHS[mm - 1]} {y}</span>
          <Link href={href(shiftMonth(ym, 1))} aria-label="Следующий месяц" className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50">→</Link>
          <Link href={href(today.slice(0, 7), today)} className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50">Сегодня</Link>
        </div>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi l="Выручка за месяц" v={money(month.total)} sub={`${month.activeDays} дн. с продажами`} />
        <Kpi l="По системе (касса, сайт, столы)" v={money(month.system)} sub={`${month.orders} заказов`} />
        <Kpi l="Внесено вручную" v={money(month.manual)} />
        <Kpi l="В среднем за день с продажами" v={month.activeDays ? money(month.total / month.activeDays) : "—"} />
      </div>

      <section className="rounded-2xl bg-white p-3 shadow-sm sm:p-5" aria-label="Календарь">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-semibold text-neutral-500 sm:gap-2">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="space-y-1 sm:space-y-2">
          {monthGrid(ym).map((week, i) => (
            <div key={i} className="grid grid-cols-7 gap-1 sm:gap-2">
              {week.map((d, j) => {
                if (!d) return <span key={j} />;
                const v = month.days.get(d)!;
                const t = v.system + v.manual;
                const sel = d === day, isToday = d === today, future = d > today;
                return (
                  <Link key={d} href={href(ym, d)} scroll aria-label={`${dayTitle(d)}: ${t ? money(t) : "продаж нет"}`} aria-current={sel ? "date" : undefined}
                    style={t ? { backgroundColor: `rgba(21,128,61,${0.06 + 0.3 * (t / max)})` } : undefined}
                    className={`flex min-h-16 flex-col justify-between rounded-lg border p-1.5 text-left transition-colors hover:border-green-600 sm:min-h-24 sm:p-2 ${sel ? "border-green-700 ring-2 ring-green-700" : isToday ? "border-green-600" : "border-neutral-200"} ${future ? "opacity-50" : ""}`}>
                    <span className={`text-xs sm:text-sm ${isToday ? "font-bold text-green-800" : "text-neutral-600"}`}>{Number(d.slice(8))}</span>
                    <span>
                      {t > 0 && <span className="block text-xs font-bold sm:text-sm">{shortMoney(t)}</span>}
                      {v.manual > 0 && <span className="block text-[10px] leading-tight text-amber-800 sm:text-xs">вручную</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">Цифра в клетке: выручка за день (завершённые заказы системы + внесённое вручную). Нажмите на день, чтобы увидеть детали{edit ? " и внести продажи" : ""}.</p>
      </section>

      <section id="day-panel" className="scroll-mt-4 space-y-4">
        {!detail && <p className="rounded-2xl bg-white p-5 text-sm text-neutral-500 shadow-sm">Выберите день в календаре.</p>}
        {detail && day && (
          <>
            <h2 className="text-xl font-bold">{dayTitle(day)}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi l="Итого за день" v={money(detail.total)} />
              <Kpi l="По системе" v={money(detail.system)} sub={`${detail.orders} заказов${detail.orders ? `, средний чек ${money(detail.avgCheck)}` : ""}`} />
              <Kpi l="Внесено вручную" v={money(detail.manual)} />
              <Kpi l="Оплаты по системе" v={detail.system ? `${money(detail.byMethod.CASH)} нал.` : "—"} sub={detail.system ? `${money(detail.byMethod.CARD)} карта, ${money(detail.byMethod.ONLINE)} онлайн` : "нет оплат"} />
            </div>

            {detail.byLocation.length > 1 && (
              <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-neutral-500"><th className="p-3">Точка</th><th className="text-right">Заказов</th><th className="text-right">По системе</th><th className="text-right">Вручную</th><th className="pr-3 text-right">Итого</th></tr></thead>
                  <tbody>{detail.byLocation.map((r) => <tr key={r.name} className="border-t border-neutral-100"><td className="p-3 font-semibold">{r.name}</td><td className="text-right">{r.orders}</td><td className="text-right">{money(r.system)}</td><td className="text-right">{r.manual ? money(r.manual) : "—"}</td><td className="pr-3 text-right font-semibold">{money(r.system + r.manual)}</td></tr>)}</tbody>
                </table>
              </div>
            )}

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold">Внесено вручную</h3>
              {detail.entries.length === 0 && <p className="text-sm text-neutral-500">За этот день вручную ничего не внесено.</p>}
              <ul className="divide-y divide-neutral-100">
                {detail.entries.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span><b>{money(e.amount)}</b> <span className="text-neutral-500">· {e.location}{e.method ? ` · ${METHOD[e.method]}` : ""}{e.ordersCount != null ? ` · ${e.ordersCount} чеков` : ""}</span>{e.note && <span className="block text-neutral-600">{e.note}</span>}</span>
                    {edit && <ActionButton action={deleteDailySalesAction} fields={{ id: e.id }} label="Удалить" danger confirmText="Удалить эту запись? Действие попадёт в журнал." />}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-neutral-500">Внесённое вручную показывается только в календаре и не входит в отчёты «Продажи» и «Финансы». Если продажи уже есть в системе, не вносите их повторно, иначе день посчитается дважды.</p>
            </div>

            {edit && day <= today && (
              <div className="space-y-3">
                <h3 className="font-semibold">Внести продажи за этот день</h3>
                <FormShell action={addDailySalesAction} submitLabel="Внести" cancelHref={href(ym, day)}>
                  <input type="hidden" name="day" value={day} />
                  <LocationField options={options} />
                  <Field label="Сумма продаж, UZS"><input name="amount" required inputMode="decimal" placeholder="1 500 000" className={fieldClass} /></Field>
                  <Field label="Как оплатили (необязательно)">
                    <select name="method" defaultValue="" className={fieldClass}><option value="">Общая сумма</option><option value="CASH">Наличные</option><option value="CARD">Карта</option><option value="ONLINE">Онлайн</option></select>
                  </Field>
                  <Field label="Число чеков (необязательно)"><input name="ordersCount" inputMode="numeric" className={fieldClass} /></Field>
                  <Field label="Комментарий (необязательно)"><input name="note" maxLength={200} placeholder="Например: продажи за смену из тетради" className={fieldClass} /></Field>
                </FormShell>
              </div>
            )}
            {edit && day > today && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">Продажи за будущие дни внести нельзя.</p>}
            {!edit && <p className="text-sm text-neutral-500">Вносить продажи могут владелец и бухгалтер.</p>}
          </>
        )}
      </section>
    </div>
  );
}
