"use client";
import { useActionState } from "react";

type State = { error?: string } | undefined;

/** Маленькая кнопка в строке таблицы: показывает понятную ошибку вместо падения страницы. */
export function RowAction({ action, label, className, confirmText, disabled }: {
  action: (prev: State, fd: FormData) => Promise<State>;
  label: string; className?: string; confirmText?: string; disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }} className="inline-block">
      <button disabled={pending || disabled} className={`${className ?? ""} disabled:opacity-60`}>{pending ? "…" : label}</button>
      {state?.error && <p className="mt-1 max-w-[220px] rounded bg-red-50 px-2 py-1 text-left text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
