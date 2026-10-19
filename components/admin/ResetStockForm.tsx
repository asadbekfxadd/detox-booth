"use client";
import { useActionState, useTransition } from "react";
import { Field, fieldClass, type OpState } from "@/components/admin/ops";

/** Обнуление остатков склада: красная кнопка, подтверждение словом. Видно только владельцу. */
export function ResetStockForm({ action, locations, word }: { action: (prev: OpState, fd: FormData) => Promise<OpState>; locations: { id: string; name: string }[]; word: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(() => formAction(fd)); }} className="space-y-4 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-neutral-600">
        Удалит все остатки и партии продуктов на складе: останутся нули. Продукты, рецепты, список ингредиентов, закупки, списания, заказы, клиенты и настройки <b>не меняются</b>.
        Действие необратимо; после него оприходуйте реальные остатки через «Склад → + Приход» или «Инвентаризация».
      </p>
      <Field label="Где обнулить">
        <select name="locationId" defaultValue="" className={fieldClass}>
          <option value="">Все точки</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label={`Для подтверждения введите слово ${word}`}>
        <input name="confirm" autoComplete="off" placeholder={word} className={fieldClass} />
      </Field>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-red-600 px-6 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60">{pending ? "Очищаем…" : "Обнулить остатки"}</button>
    </form>
  );
}
