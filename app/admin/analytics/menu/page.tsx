import Link from "next/link";
import { pageGuard } from "@/lib/guard";
import { getScope } from "@/lib/location";
import { getMenuReport } from "@/services/reports";
import { money, pct } from "@/lib/format";
import { XYZ_LIMITS } from "@/lib/xyz";

type SP = { days?: string };
const th = "p-2 text-left font-medium text-neutral-500";
const ABC: Record<string, string> = { A: "bg-lime-100 text-green-900", B: "bg-amber-100 text-amber-900", C: "bg-neutral-100 text-neutral-700" };
const XYZC: Record<string, string> = { X: "bg-lime-100 text-green-900", Y: "bg-amber-100 text-amber-900", Z: "bg-red-100 text-red-800" };
const ADVICE: Record<string, string> = {
  AX: "Основа меню: держите всегда в наличии", AY: "Важное блюдо с колебаниями: держите запас на пик", AZ: "Приносит много, но спрос скачет: готовьте под заказ",
  BX: "Стабильный середняк", BY: "Середняк", BZ: "Середняк с непредсказуемым спросом",
  CX: "Стабильно, но мало: проверьте цену", CY: "Мало и нестабильно: кандидат на замену", CZ: "Мало и непредсказуемо: кандидат на вывод из меню",
};
const DAYS = [14, 30, 60, 90];

export default async function MenuReportPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageGuard("dashboard.view");
  const sp = await searchParams;
  const { locationId } = await getScope();
  const d = Number(sp.days);
  const days = DAYS.includes(d) ? d : 30;
  const r = await getMenuReport(locationId, days);
  return (
    <div className="space-y-6">
      <div><Link href="/admin/analytics" className="text-sm text-green-800 underline">← Аналитика</Link><h1 className="text-2xl font-bold">Меню: ABC×XYZ и непродаваемые блюда</h1></div>

      <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">ABC×XYZ за последние {r.weeks} недель</h2>
        <p className="mb-3 text-xs text-neutral-500">ABC — вклад в выручку (A — первые 80%, B — следующие 15%, C — остальное). XYZ — насколько ровно блюдо продаётся по неделям: X — отклонение до {XYZ_LIMITS.x}%, Y — до {XYZ_LIMITS.y}%, Z — больше. Метка «мало данных» значит, что продаж слишком мало для уверенного вывода.</p>
        {r.menu.length === 0 ? <p className="text-sm text-neutral-500">Продаж за {r.weeks} недель нет.</p> : (
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Блюдо</th><th className={th}>Категория</th><th className={`${th} text-right`}>Продано</th><th className={`${th} text-right`}>Выручка</th><th className={`${th} text-right`}>Доля</th><th className={`${th} text-right`}>Разброс</th><th className={th}>Класс</th><th className={th}>Что делать</th></tr></thead>
            <tbody>{r.menu.map((m) => (
              <tr key={m.id} className="border-t border-neutral-100">
                <td className="p-2 font-semibold">{m.name}</td><td className="p-2">{m.category}</td><td className="p-2 text-right">{m.qty}</td><td className="p-2 text-right">{money(m.revenue)}</td><td className="p-2 text-right">{pct(m.share)}</td>
                <td className="p-2 text-right">{m.cv == null ? "—" : pct(m.cv)}</td>
                <td className="p-2 whitespace-nowrap">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${ABC[m.abc]}`}>{m.abc}</span>{" "}
                  {m.xyz && <span className={`rounded px-2 py-0.5 text-xs font-bold ${XYZC[m.xyz]}`}>{m.xyz}</span>}
                  {m.lowData && <span className="ml-1 text-xs text-neutral-500">мало данных</span>}
                </td>
                <td className="p-2 text-xs text-neutral-600">{m.xyz && !m.lowData ? ADVICE[m.abc + m.xyz] : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Не продавались {days} дней</h2>
          <div className="flex gap-2">{DAYS.map((x) => <Link key={x} href={`/admin/analytics/menu?days=${x}`} className={`rounded-full px-3 py-1 text-sm ${x === days ? "bg-green-700 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}>{x} дн.</Link>)}</div>
        </div>
        <p className="mb-3 mt-1 text-xs text-neutral-500">Активные блюда, добавленные в меню раньше этого срока, без единой оплаченной продажи. Новые блюда сюда не попадают.</p>
        {r.unsold.length === 0 ? <p className="text-sm text-neutral-500">Все блюда продавались.</p> : (
          <table className="w-full text-sm">
            <thead><tr><th className={th}>Блюдо</th><th className={th}>Категория</th><th className={`${th} text-right`}>Цена</th><th className={th}>Последняя продажа</th><th className={th}>Статус</th></tr></thead>
            <tbody>{r.unsold.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100">
                <td className="p-2 font-semibold">{u.name}</td><td className="p-2">{u.category}</td><td className="p-2 text-right">{money(u.price)}</td>
                <td className="p-2">{u.daysSince == null ? "никогда" : `${u.daysSince} дн. назад`}</td>
                <td className="p-2 text-xs">{u.available ? "в продаже" : "скрыто с витрины"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
