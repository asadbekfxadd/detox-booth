"use client";
import { useActionState } from "react";
import { assignTableAction } from "@/app/admin/reservations/actions";

/** Смена стола у брони. Сервер проверит вместимость и занятость. */
export function AssignTable({ id, tableId, tables }: { id: string; tableId: string | null; tables: { id: string; number: number; seats: number }[] }) {
  const [state, run, pending] = useActionState(assignTableAction, undefined);
  return (
    <form action={run} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-1.5">
        <select key={tableId ?? "none"} name="tableId" defaultValue={tableId ?? ""} aria-label="Стол" disabled={pending} className="w-36 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm">
          {!tableId && <option value="">—</option>}
          {tables.map((t) => <option key={t.id} value={t.id}>№{t.number} · {t.seats} мест</option>)}
        </select>
        <button disabled={pending} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50">{pending ? "…" : "Сменить"}</button>
      </div>
      {state?.error && <p role="alert" className="max-w-[14rem] rounded bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
