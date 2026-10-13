"use client";
import { useActionState } from "react";
import type { OpState } from "@/components/admin/ops";

/** Кнопка действия курьера: крупная, ошибка (например, заказ уже взял другой) показывается под ней. */
export function CourierButton({ action, id, label, tone = "primary", confirmText }: {
  action: (p: OpState, fd: FormData) => Promise<OpState>; id: string; label: string; tone?: "primary" | "ghost" | "done"; confirmText?: string;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const cls = tone === "done" ? "bg-green-700 text-white" : tone === "ghost" ? "border border-neutral-300 bg-white text-neutral-800" : "bg-neutral-900 text-white";
  return (
    <form action={run} onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className={`min-h-14 w-full rounded-xl px-4 text-lg font-bold disabled:opacity-60 ${cls}`}>{pending ? "…" : label}</button>
      {state?.error && <p role="alert" className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">{state.error}</p>}
    </form>
  );
}
