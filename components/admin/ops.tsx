"use client";
import Link from "next/link";
import { useActionState } from "react";

export type OpState = { error?: string } | undefined;

export const fieldClass = "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";

export function FormShell({ action, submitLabel, cancelHref, children }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>; submitLabel: string; cancelHref: string; children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      {children}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Сохраняем…" : submitLabel}</button>
        <Link href={cancelHref} className="rounded-xl border border-neutral-200 px-6 py-2.5">Отмена</Link>
      </div>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block text-neutral-600">{label}</span>{children}</label>;
}

export function LocationField({ name = "locationId", label = "Точка", options, defaultValue }: {
  name?: string; label?: string; options: { id: string; name: string }[]; defaultValue?: string;
}) {
  if (options.length === 1) {
    return <div className="text-sm"><span className="mb-1 block text-neutral-600">{label}</span><p className="py-2 font-medium">{options[0].name}</p><input type="hidden" name={name} value={options[0].id} /></div>;
  }
  return (
    <Field label={label}>
      <select name={name} defaultValue={defaultValue} required className={fieldClass}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </Field>
  );
}
