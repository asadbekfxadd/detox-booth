import { pageGuard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { ActionButton } from "@/components/admin/ActionButton";
import { listHappyHours } from "@/services/happy-hour";
import { DAY_LABEL, hhmm } from "@/lib/happy-hour";
import { createHappyAction, toggleHappyAction, deleteHappyAction } from "./actions";

export const metadata = { title: "Счастливые часы" };
export const dynamic = "force-dynamic";
const OK: Record<string, string> = { created: "Правило добавлено", toggled: "Готово", deleted: "Правило удалено" };
const daysText = (d: number[]) => (d.length === 7 ? "каждый день" : d.map((x) => DAY_LABEL[x]).join(", "));

export default async function HappyHourPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("settings.edit");
  const sp = await searchParams;
  const [rows, cats] = await Promise.all([listHappyHours(), prisma.category.findMany({ orderBy: { sort: "asc" }, select: { id: true, name: true } })]);
  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">Счастливые часы</h1>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <p className="text-sm text-neutral-600">В заданные дни и часы цена выбранных позиций снижается на указанный процент: на сайте (со старой ценой рядом), на кассе, у официанта и при заказе за столом. Время считается по Ташкенту. Скидка действует на цену позиции, опции остаются по полной цене. Если подходят два правила, берётся большая скидка.</p>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Правило</th><th>Когда</th><th>Что</th><th className="text-right">Скидка</th><th className="p-3 text-right">Действия</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-neutral-500">Правил пока нет. Добавьте первое ниже.</td></tr>}
            {rows.map((h) => (
              <tr key={h.id} className={`border-t border-neutral-100 ${h.isActive ? "" : "opacity-50"}`}>
                <td className="p-3 font-medium">{h.name}{!h.isActive && <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs">выключено</span>}</td>
                <td className="text-neutral-600">{daysText(h.days)}, {hhmm(h.startMin)}–{hhmm(h.endMin)}</td>
                <td className="text-neutral-600">{h.category?.name ?? "всё меню"}</td>
                <td className="text-right font-semibold">−{h.percent}%</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <ActionButton action={toggleHappyAction} fields={{ id: h.id, active: h.isActive ? "0" : "1" }} label={h.isActive ? "Выключить" : "Включить"} />
                    <ActionButton action={deleteHappyAction} fields={{ id: h.id }} label="Удалить" danger confirmText={`Удалить правило «${h.name}»?`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-lg font-bold">Добавить правило</h2>
      <FormShell action={createHappyAction} submitLabel="Добавить" cancelHref="/admin/happy-hour">
        <Field label="Название (например, Утренний детокс)"><input name="name" required maxLength={60} className={fieldClass} /></Field>
        <Field label="Скидка, %"><input name="percent" type="number" required min="1" max="90" step="1" defaultValue={20} className={fieldClass} /></Field>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Дни недели</legend>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="days" value={d} defaultChecked={d <= 5} className="size-4" />{DAY_LABEL[d]}</label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="С"><input name="start" type="time" required defaultValue="15:00" className={fieldClass} /></Field>
          <Field label="До"><input name="end" type="time" required defaultValue="17:00" className={fieldClass} /></Field>
        </div>
        <Field label="Где действует">
          <select name="categoryId" className={fieldClass} defaultValue="">
            <option value="">Всё меню</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </FormShell>
    </div>
  );
}
