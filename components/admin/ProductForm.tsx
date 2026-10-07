"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/admin/products/actions";

type Initial = Partial<{
  name: string; description: string | null; categoryId: string; price: number; image: string | null;
  calories: number | null; protein: number | null; carbs: number | null; fat: number | null; volumeMl: number | null;
  prepMinutes: number; allergens: string[]; isVegan: boolean; isHighProtein: boolean; isSugarFree: boolean; isAvailable: boolean;
}>;

const input = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block text-sm"><span className="mb-1 block text-neutral-600">{label}</span>{children}</label>
);

export function ProductForm({ categories, initial = {}, action, submitLabel }: {
  categories: { id: string; name: string }[]; initial?: Initial;
  action: (prev: FormState, fd: FormData) => Promise<FormState>; submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const n = (v: number | null | undefined) => (v ?? "") as number | string;
  return (
    <form action={formAction} className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Название *"><input name="name" required defaultValue={initial.name} className={input} /></Field>
        <Field label="Категория *">
          <select name="categoryId" required defaultValue={initial.categoryId ?? ""} className={input}>
            <option value="" disabled>Выберите…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Цена, UZS *"><input name="price" type="number" min={0} step={1} required defaultValue={initial.price} className={input} /></Field>
        <Field label="Ссылка на фото"><input name="image" type="url" placeholder="https://…" defaultValue={initial.image ?? ""} className={input} /></Field>
        <div className="md:col-span-2"><Field label="Описание"><textarea name="description" rows={2} defaultValue={initial.description ?? ""} className={input} /></Field></div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Field label="Калории"><input name="calories" type="number" min={0} defaultValue={n(initial.calories)} className={input} /></Field>
        <Field label="Белки, г"><input name="protein" type="number" step="0.1" min={0} defaultValue={n(initial.protein)} className={input} /></Field>
        <Field label="Углеводы, г"><input name="carbs" type="number" step="0.1" min={0} defaultValue={n(initial.carbs)} className={input} /></Field>
        <Field label="Жиры, г"><input name="fat" type="number" step="0.1" min={0} defaultValue={n(initial.fat)} className={input} /></Field>
        <Field label="Объём, мл"><input name="volumeMl" type="number" min={0} defaultValue={n(initial.volumeMl)} className={input} /></Field>
        <Field label="Готовка, мин"><input name="prepMinutes" type="number" min={0} defaultValue={initial.prepMinutes ?? 3} className={input} /></Field>
      </div>
      <Field label="Аллергены (через запятую)"><input name="allergens" defaultValue={(initial.allergens ?? []).join(", ")} className={input} /></Field>
      <div className="flex flex-wrap gap-6 text-sm">
        {([["isVegan", "Vegan", initial.isVegan], ["isHighProtein", "High protein", initial.isHighProtein], ["isSugarFree", "Sugar free", initial.isSugarFree], ["isAvailable", "Доступен для заказа", initial.isAvailable ?? true]] as const).map(([k, l, v]) => (
          <label key={k} className="flex items-center gap-2"><input type="checkbox" name={k} defaultChecked={!!v} className="size-4 accent-green-700" />{l}</label>
        ))}
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Сохраняем…" : submitLabel}</button>
        <Link href="/admin/products" className="rounded-xl border border-neutral-200 px-6 py-2.5">Отмена</Link>
      </div>
    </form>
  );
}
