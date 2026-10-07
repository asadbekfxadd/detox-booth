"use client";
import { useActionState, useState } from "react";
import type { OpState } from "@/components/admin/ops";

type Action = (prev: OpState, fd: FormData) => Promise<OpState>;
const input = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";

/** Форма с причиной: отмена заказа (с выбором «вернуть ингредиенты») или возврат денег. */
export function ReasonForm({ action, id, label, submitLabel, restockDefault, showRestock, hint }: {
  action: Action; id: string; label: string; submitLabel: string; restockDefault?: boolean; showRestock?: boolean; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, undefined);
  if (!open) return <button onClick={() => setOpen(true)} className="rounded-xl border border-red-200 bg-white px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">{label}</button>;
  return (
    <form action={formAction} className="w-full max-w-md space-y-3 rounded-xl border border-red-200 bg-red-50/40 p-4">
      <input type="hidden" name="id" value={id} />
      {hint && <p className="text-sm text-neutral-600">{hint}</p>}
      <input name="reason" required placeholder="Причина" className={input} />
      {showRestock && (
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="restock" defaultChecked={restockDefault} className="mt-1" /><span>Вернуть ингредиенты на склад<br /><span className="text-neutral-500">Отметьте, если продукт ещё не готовили</span></span></label>
      )}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "…" : submitLabel}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm">Назад</button>
      </div>
    </form>
  );
}
