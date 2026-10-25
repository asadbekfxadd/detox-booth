"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { OpState } from "@/components/admin/ops";

const input = "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg outline-none focus:border-green-600";

export function OpenShiftForm({ action, locations, defaultLocationId, cashier }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>;
  locations: { id: string; name: string }[]; defaultLocationId: string; cashier: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="mx-auto w-full max-w-md space-y-5 rounded-3xl bg-white p-8 shadow">
      <div>
        <h1 className="text-2xl font-bold">Открытие смены</h1>
        <p className="text-sm text-neutral-500">Кассир: {cashier}</p>
      </div>
      {locations.length === 1 ? (
        <div><p className="text-sm text-neutral-500">Точка</p><p className="text-lg font-semibold">{locations[0].name}</p><input type="hidden" name="locationId" value={locations[0].id} /></div>
      ) : (
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Точка</span>
          <select name="locationId" defaultValue={defaultLocationId} required className={input}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}
      <label className="block text-sm"><span className="mb-1 block text-neutral-600">Наличных в кассе на начало смены, UZS</span>
        <input name="openingCash" type="number" min="0" step="any" required inputMode="decimal" className={input} />
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-green-700 py-3 text-lg font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Открываем…" : "Открыть смену"}</button>
    </form>
  );
}

export function CloseShiftForm({ action, expected }: { action: (prev: OpState, fd: FormData) => Promise<OpState>; expected: number }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} onSubmit={(e) => { if (!window.confirm("Закрыть смену? После этого продажи на ней будут недоступны.")) e.preventDefault(); }} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">Закрытие смены</h2>
      <p className="text-sm text-neutral-500">По системе в кассе должно быть <b>{new Intl.NumberFormat("ru-RU").format(Math.round(expected))} UZS</b> наличных. Пересчитайте деньги и введите фактическую сумму.</p>
      <label className="block text-sm"><span className="mb-1 block text-neutral-600">Фактически наличных, UZS</span>
        <input name="closingCash" type="number" min="0" step="any" required inputMode="decimal" className={input} />
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-xl bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Закрываем…" : "Закрыть смену"}</button>
        <Link href="/pos" className="rounded-xl border border-neutral-200 px-6 py-3">Назад в кассу</Link>
      </div>
    </form>
  );
}

export function CashMovementForm({ action, reasons }: { action: (prev: OpState, fd: FormData) => Promise<OpState>; reasons: string[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold">Внести или изъять наличные</h2>
        <p className="text-sm text-neutral-500">Размен, инкассация, оплата поставщику из кассы. Сумма сразу попадёт в расчёт «ожидается в кассе» и в отчёт смены.</p>
      </div>
      <div className="flex gap-3">
        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 has-[:checked]:border-green-700 has-[:checked]:bg-lime-50"><input type="radio" name="type" value="IN" defaultChecked /> Внести</label>
        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 has-[:checked]:border-red-600 has-[:checked]:bg-red-50"><input type="radio" name="type" value="OUT" /> Изъять</label>
      </div>
      <label className="block text-sm"><span className="mb-1 block text-neutral-600">Сумма, UZS</span>
        <input name="amount" type="number" min="0" step="any" required inputMode="decimal" className={input} />
      </label>
      <label className="block text-sm"><span className="mb-1 block text-neutral-600">Причина</span>
        <input name="reason" list="cash-reasons" required minLength={3} maxLength={200} placeholder="Например, Размен" className={input} />
        <datalist id="cash-reasons">{reasons.map((r) => <option key={r} value={r} />)}</datalist>
      </label>
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-neutral-900 px-6 py-3 font-semibold text-white hover:bg-neutral-700 disabled:opacity-60">{pending ? "Записываем…" : "Записать"}</button>
    </form>
  );
}
