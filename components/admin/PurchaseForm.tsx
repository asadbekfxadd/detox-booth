"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { LocationField, Field, fieldClass, type OpState } from "@/components/admin/ops";
import { BASE_LABEL, bigUnit, round6 } from "@/components/admin/units";

type Ing = { id: string; name: string; unit: string; avgCost: number };
type Row = { ingredientId: string; quantity: string; unitCost: string; big: boolean };
const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
const empty = (): Row => ({ ingredientId: "", quantity: "", unitCost: "", big: false });

export function PurchaseForm({ action, suppliers, ingredients, locations, defaultLocationId }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>;
  suppliers: { id: string; name: string }[]; ingredients: Ing[];
  locations: { id: string; name: string }[]; defaultLocationId: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [rows, setRows] = useState<Row[]>([empty()]);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const set = (idx: number, patch: Partial<Row>) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const mult = (r: Row) => { const i = byId.get(r.ingredientId); const b = i ? bigUnit(i.unit) : null; return r.big && b ? b.mult : 1; };
  // на сервер уходит всегда базовая единица (г, мл, шт)
  const payload = rows.map((r) => ({
    ingredientId: r.ingredientId,
    quantity: r.quantity === "" ? "" : String(round6(Number(r.quantity) * mult(r))),
    unitCost: r.unitCost === "" ? "" : String(round6(Number(r.unitCost) / mult(r))),
  }));
  const total = rows.reduce((a, r) => a + (Number(r.quantity) || 0) * (Number(r.unitCost) || 0), 0);

  function pick(idx: number, id: string) {
    const i = byId.get(id);
    set(idx, { ingredientId: id, big: false, quantity: "", unitCost: i ? String(round6(i.avgCost)) : "" });
  }
  function toggle(idx: number, next: boolean) {
    const r = rows[idx]; const i = byId.get(r.ingredientId); const b = i ? bigUnit(i.unit) : null;
    if (!b) return;
    const k = next ? 1 / b.mult : b.mult;
    set(idx, { big: next, quantity: r.quantity === "" ? "" : String(round6(Number(r.quantity) * k)), unitCost: r.unitCost === "" ? "" : String(round6(Number(r.unitCost) / k)) });
  }

  return (
    <form action={formAction} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <LocationField options={locations} defaultValue={defaultLocationId} />
        <Field label="Поставщик">
          <select name="supplierId" required defaultValue="" className={fieldClass}>
            <option value="" disabled>Выберите…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Позиции</p>
        <p className="text-xs text-neutral-500">Количество и цена указываются в одной единице (рядом с полем). Для г и мл можно переключить на кг и л.</p>
        {rows.map((r, idx) => {
          const ing = byId.get(r.ingredientId);
          const b = ing ? bigUnit(ing.unit) : null;
          const base = ing ? BASE_LABEL[ing.unit] : "";
          const shown = r.big && b ? b.label : base;
          const lineTotal = (Number(r.quantity) || 0) * (Number(r.unitCost) || 0);
          return (
            <div key={idx} className="grid items-end gap-2 md:grid-cols-[1fr_190px_190px_110px_40px]">
              <Field label={idx === 0 ? "Ингредиент" : ""}>
                <select value={r.ingredientId} onChange={(e) => pick(idx, e.target.value)} className={fieldClass}>
                  <option value="" disabled>Выберите…</option>
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({BASE_LABEL[i.unit]})</option>)}
                </select>
              </Field>
              <Field label={idx === 0 ? `Количество${shown ? `, ${shown}` : ""}` : ""}>
                <div className="flex gap-1">
                  <input type="number" min="0" step="any" value={r.quantity} onChange={(e) => set(idx, { quantity: e.target.value })} className={fieldClass} />
                  {b && (
                    <select value={r.big ? "big" : "base"} onChange={(e) => toggle(idx, e.target.value === "big")} className="rounded-lg border border-neutral-200 bg-white px-1 text-sm">
                      <option value="base">{base}</option><option value="big">{b.label}</option>
                    </select>
                  )}
                </div>
              </Field>
              <Field label={idx === 0 ? `Цена за 1 ${shown || "ед."}, UZS` : ""}>
                <input type="number" min="0" step="any" value={r.unitCost} onChange={(e) => set(idx, { unitCost: e.target.value })} className={fieldClass} />
              </Field>
              <p className="py-2 text-right text-sm text-neutral-600">{fmt(lineTotal)}</p>
              <button type="button" disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, i) => i !== idx))} className="rounded-lg border border-neutral-200 py-2 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30" aria-label="Удалить позицию">×</button>
            </div>
          );
        })}
        <button type="button" onClick={() => setRows((r) => [...r, empty()])} className="text-sm text-green-800 underline">+ Добавить позицию</button>
      </div>

      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <p className="text-right text-lg font-bold">Итого: {fmt(total)} UZS</p>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button name="intent" value="ordered" disabled={pending} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Сохраняем…" : "Оформить заказ"}</button>
        <button name="intent" value="draft" disabled={pending} className="rounded-xl border border-neutral-200 px-6 py-2.5 hover:bg-neutral-50 disabled:opacity-60">Сохранить черновик</button>
        <Link href="/admin/purchases" className="rounded-xl border border-neutral-200 px-6 py-2.5">Отмена</Link>
      </div>
    </form>
  );
}

export type ReceiveLine = { id: string; name: string; unit: string; quantity: number; unitCost: number; expiresAt: string };

export function ReceiveForm({ action, purchaseId, lines }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>; purchaseId: string; lines: ReceiveLine[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="id" value={purchaseId} />
      <h2 className="text-lg font-bold">Приёмка товара</h2>
      <p className="text-sm text-neutral-500">Проверьте фактическое количество, цену и срок годности и поправьте, если пришло не то, что заказывали. Количество и цена здесь в учётных единицах (г, мл, шт).</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-500"><th className="py-1">Ингредиент</th><th>Количество</th><th>Цена за 1 ед., UZS</th><th>Срок годности</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-t border-neutral-100">
              <td className="py-2 font-medium">{l.name}</td>
              <td className="pr-3"><div className="flex items-center gap-2"><input name={`qty_${l.id}`} type="number" min="0" step="any" defaultValue={l.quantity} required className={fieldClass} /><span className="text-neutral-500">{BASE_LABEL[l.unit]}</span></div></td>
              <td className="pr-3"><div className="flex items-center gap-2"><input name={`cost_${l.id}`} type="number" min="0" step="any" defaultValue={l.unitCost} required className={fieldClass} /><span className="whitespace-nowrap text-neutral-500">/ {BASE_LABEL[l.unit]}</span></div></td>
              <td><input name={`exp_${l.id}`} type="date" defaultValue={l.expiresAt} className={fieldClass} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Принимаем…" : "Принять на склад"}</button>
    </form>
  );
}
