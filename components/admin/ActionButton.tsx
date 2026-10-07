"use client";
import { useActionState } from "react";

type State = { error?: string } | undefined;

/** Кнопка-действие с скрытыми полями; ошибку показывает текстом под кнопкой. */
export function ActionButton({ action, fields, label, danger, confirmText }: {
  action: (prev: State, fd: FormData) => Promise<State>;
  fields: Record<string, string>; label: string; danger?: boolean; confirmText?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }} className="inline-block">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button disabled={pending} className={`rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-60 ${danger ? "border border-red-200 bg-white text-red-700 hover:bg-red-50" : "bg-green-700 text-white hover:bg-green-800"}`}>
        {pending ? "…" : label}
      </button>
      {state?.error && <p className="mt-2 max-w-xs rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
