import Link from "next/link";
import { pageGuard, formLocations } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { ActionButton } from "@/components/admin/ActionButton";
import { AssignTable } from "@/components/admin/AssignTable";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { bookingConfig, listReservations } from "@/services/reservations";
import { STATUS_LABEL } from "@/lib/booking";
import { hhmm } from "@/lib/happy-hour";
import { tashkentDay, TZ_OFFSET_MS } from "@/lib/time";
import { sum } from "@/lib/format";
import { createStaffReservationAction, reservationStatusAction, depositAction } from "./actions";

export const metadata = { title: "Бронь столов" };
export const dynamic = "force-dynamic";
const OK: Record<string, string> = { created: "Бронь внесена" };
const TONE: Record<string, string> = { PENDING: "bg-amber-100 text-amber-900", CONFIRMED: "bg-lime-100 text-green-900", SEATED: "bg-sky-100 text-sky-900", CANCELLED: "bg-neutral-100 text-neutral-500", NO_SHOW: "bg-red-100 text-red-800" };
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ d?: string; ok?: string }> }) {
  await pageGuard("reservations.manage");
  const sp = await searchParams;
  const today = tashkentDay();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : today;
  const { options, locationId, defaultId } = await formLocations();
  const [rows, cfg, tables] = await Promise.all([
    listReservations(locationId, day), bookingConfig(),
    prisma.diningTable.findMany({ where: { ...(locationId ? { locationId } : {}), isActive: true }, orderBy: [{ locationId: "asc" }, { number: "asc" }], select: { id: true, number: true, seats: true, locationId: true } }),
  ]);
  const active = rows.filter((r) => r.status === "PENDING" || r.status === "CONFIRMED");
  const guests = active.reduce((a, r) => a + r.guests, 0);
  const nav = "rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50";
  return (
    <div className="max-w-6xl space-y-5">
      <AutoRefresh active everyMs={15000} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Бронь столов · {new Date(`${day}T12:00:00Z`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</h1>
          <p className="text-sm text-neutral-500">Активных броней: {active.length}, гостей: {guests}. {cfg.enabled ? "Онлайн-бронь на сайте включена." : "Онлайн-бронь на сайте выключена: включите в «Настройках» → «Бронь столов»."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/reservations?d=${shift(day, -1)}`} className={nav}>← Вчера</Link>
          <Link href="/admin/reservations" className={nav}>Сегодня</Link>
          <Link href={`/admin/reservations?d=${shift(day, 1)}`} className={nav}>Завтра →</Link>
        </div>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Время</th><th>Гость</th><th className="px-2 text-center">Гостей</th><th>Стол</th><th>Статус</th><th>Депозит</th><th className="p-3 text-right">Действия</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-neutral-500">На этот день броней нет.</td></tr>}
            {rows.map((r) => {
              const open = r.status === "PENDING" || r.status === "CONFIRMED";
              const mine = tables.filter((t) => t.locationId === r.locationId);
              const min = Math.round((r.startsAt.getTime() + TZ_OFFSET_MS) / 60000) % 1440;
              return (
                <tr key={r.id} className={`border-t border-neutral-100 align-top ${open ? "" : "opacity-60"}`}>
                  <td className="p-3 font-bold">{hhmm(min)}<span className="block text-xs font-normal text-neutral-500">{r.durationMin} мин</span></td>
                  <td className="py-3"><b>{r.name}</b><a href={`tel:${r.phone}`} className="block text-green-800 underline">{r.phone}</a>{r.note && <span className="block max-w-[14rem] text-xs text-neutral-500">{r.note}</span>}{options.length > 1 && <span className="block text-xs text-neutral-400">{r.location.name}</span>}</td>
                  <td className="px-2 py-3 text-center font-semibold">{r.guests}</td>
                  <td className="py-3">{open ? <AssignTable id={r.id} tableId={r.tableId} tables={mine} /> : (r.table ? `№${r.table.number}` : "—")}</td>
                  <td className="px-2 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>{r.source === "STAFF" && <span className="mt-1 block text-xs text-neutral-400">внесена вручную</span>}</td>
                  <td className="py-3">{r.deposit > 0 ? (<><b>{sum(r.deposit)}</b><span className={`block text-xs ${r.depositPaid ? "text-green-700" : "text-amber-700"}`}>{r.depositPaid ? "получен" : "не получен"}</span></>) : "—"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-start justify-end gap-2">
                      {r.status === "PENDING" && <ActionButton action={reservationStatusAction} fields={{ id: r.id, to: "CONFIRMED" }} label="Подтвердить" />}
                      {open && <ActionButton action={reservationStatusAction} fields={{ id: r.id, to: "SEATED" }} label="Гости пришли" />}
                      {r.deposit > 0 && open && <ActionButton action={depositAction} fields={{ id: r.id, paid: r.depositPaid ? "0" : "1" }} label={r.depositPaid ? "Депозит не получен" : "Депозит получен"} />}
                      {r.status === "CONFIRMED" && <ActionButton action={reservationStatusAction} fields={{ id: r.id, to: "NO_SHOW" }} label="Не пришли" danger confirmText="Отметить, что гости не пришли?" />}
                      {open && <ActionButton action={reservationStatusAction} fields={{ id: r.id, to: "CANCELLED" }} label="Отменить" danger confirmText={`Отменить бронь ${r.name}?`} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h2 className="text-lg font-bold">Внести бронь (по телефону)</h2>
      <FormShell action={createStaffReservationAction} submitLabel="Внести бронь" cancelHref={`/admin/reservations?d=${day}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Точка">
            <select name="locationId" defaultValue={defaultId} required className={fieldClass}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </Field>
          <Field label="Стол (пусто — подобрать автоматически)">
            <select name="tableId" defaultValue="" className={fieldClass}>
              <option value="">Подобрать автоматически</option>
              {tables.filter((t) => options.length === 1 || t.locationId === defaultId).map((t) => <option key={t.id} value={t.id}>№{t.number} · {t.seats} мест</option>)}
            </select>
          </Field>
          <Field label="Имя"><input name="name" required minLength={2} maxLength={60} className={fieldClass} /></Field>
          <Field label="Телефон"><input name="phone" required inputMode="tel" placeholder="+998 90 123 45 67" className={fieldClass} /></Field>
          <Field label="Дата"><input name="day" type="date" required defaultValue={day} className={fieldClass} /></Field>
          <Field label="Время"><input name="time" type="time" required defaultValue="19:00" className={fieldClass} /></Field>
          <Field label="Гостей"><input name="guests" type="number" min={1} max={100} required defaultValue={2} className={fieldClass} /></Field>
          <Field label="Комментарий"><input name="note" maxLength={300} className={fieldClass} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" defaultChecked className="size-4" />Сразу подтвердить</label>
      </FormShell>
    </div>
  );
}
