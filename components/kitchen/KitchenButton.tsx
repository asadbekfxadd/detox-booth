"use client";
import { useActionState } from "react";
import { kitchenAdvanceAction } from "@/app/kitchen/actions";

/** Крупная кнопка перехода к следующему статусу. Ошибку (например, не хватает ингредиентов) показывает под кнопкой. */
export function KitchenButton({ id, to, label, tone }: { id: string; to: string; label: string; tone: "primary" | "ready" | "done" }) {
  const [state, action, pending] = useActionState(kitchenAdvanceAction, undefined);
  const cls = tone === "ready" ? "bg-lime-400 text-neutral-950 hover:bg-lime-300" : tone === "done" ? "bg-neutral-700 text-white hover:bg-neutral-600" : "bg-amber-400 text-neutral-950 hover:bg-amber-300";
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <button disabled={pending} className={`min-h-14 w-full rounded-xl px-4 text-lg font-extrabold disabled:opacity-60 ${cls}`}>{pending ? "…" : label}</button>
      {state?.error && <p role="alert" className="mt-2 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200">{state.error}</p>}
    </form>
  );
}
