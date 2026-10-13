"use client";
import { useActionState } from "react";
import { assignCourierAction } from "@/app/admin/delivery/actions";

/** Выбор курьера для заказа. Пустое значение снимает назначение. */
export function AssignCourier({ orderId, courierId, couriers, disabled }: {
  orderId: string; courierId: string | null; couriers: { id: string; name: string; active: number }[]; disabled?: boolean;
}) {
  const [state, run, pending] = useActionState(assignCourierAction, undefined);
  return (
    <form action={run} className="space-y-1">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-col gap-2">
        <select key={courierId ?? "none"} name="courierId" defaultValue={courierId ?? ""} disabled={disabled || pending} aria-label="Курьер" className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm">
          <option value="">Без курьера</option>
          {couriers.map((c) => <option key={c.id} value={c.id}>{c.name} · в работе: {c.active}</option>)}
        </select>
        <button disabled={disabled || pending} className="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "…" : "Назначить"}</button>
      </div>
      {state?.error && <p role="alert" className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
