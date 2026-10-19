"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { LocationField, Field, fieldClass, type OpState } from "@/components/admin/ops";
import { recvUnit, round6 } from "@/components/admin/units";

type Ing = { id: string; name: string; unit: string; avgCost: number };
type Row = { ingredientId: string; quantity: string; unitCost: string };
const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
const empty = (): Row => ({ ingredientId: "", quantity: "", unitCost: "" });

export function PurchaseForm({ action, suppliers, ingredients, locations, defaultLocationId }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>;
  suppliers: { id: string; name: string }[]; ingredients: Ing[];
  locations: { id: string; name: string }[]; defaultLocationId: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [rows, setRows] = useState<Row[]>([empty()]);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const set = (idx: number, patch: Partial<Row>) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const mult = (r: Row) => { const i = byId.get(r.ingredientId); return i ? recvUnit(i.unit).mult : 1; };
  // вводим кг, л и шт, на сервер уходит учётная единица (г, мл, шт)
  const payload = rows.map((r) => ({
    ingredientId: r.ingredientId,
    quantity: r.quantity === "" ? "" : String(round6(Number(r.quantity) * mult(r))),
    unitCost: r.unitCost === "" ? "" : String(round6(Number(r.unitCost) / mult(r))),
  }));
  const total = rows.reduce((a, r) => a + (Number(r.quantity) || 0) * (Number(r.unitCost) || 0), 0);

  function pick(idx: number, id: string) {
    const i = byId.get(id);
    set(idx, { ingredientId: id, quantity: "", unitCost: i && i.avgCost > 0 ? String(round6(i.avgCost * recvUnit(i.unit).mult)) : "" });
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
        <p className="text-xs text-neutral-500">Количество в кг, л или штуках, цена за 1 кг, 1 л или 1 шт.</p>
        {rows.map((r, idx) => {
          const ing = byId.get(r.ingredientId);
          const shown = ing ? recvUnit(ing.unit).label : "";
          const lineTotal = (Number(r.quantity) || 0) * (Number(r.unitCost) || 0);
          return (
            <div key={idx} className="grid items-end gap-2 md:grid-cols-[1fr_190px_190px_110px_40px]">
              <Field label={idx === 0 ? "Ингредиент" : ""}>
                <select value={r.ingredientId} onChange={(e) => pick(idx, e.target.value)} className={fieldClass}>
                  <option value="" disabled>Выберите…</option>
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({recvUnit(i.unit).label})</option>)}
                </select>
              </Field>
              <Field label={idx === 0 ? `Количество${shown ? `, ${shown}` : ""}` : ""}>
                <div className="relative">
                  <input type="number" min="0" step="any" inputMode="decimal" value={r.quantity} onChange={(e) => set(idx, { quantity: e.target.value })} className={`${fieldClass} ${shown ? "pr-10" : ""}`} />
                  {shown && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-neutral-500">{shown}</span>}
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

/** Приёмка заказа: количество и цена видны в кг, л, шт; в форму для сервера уходят учётные единицы (г, мл, шт) */
function ReceiveRow({ l }: { l: ReceiveLine }) {
  const u = recvUnit(l.unit);
  const [qty, setQty] = useState(String(round6(l.quantity / u.mult)));
  const [cost, setCost] = useState(String(round6(l.unitCost * u.mult)));
  return (
    <tr className="border-t border-neutral-100">
      <td className="py-2 font-medium">{l.name}</td>
      <td className="pr-3">
        <div className="flex items-center gap-2"><input type="number" min="0" step="any" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} required aria-label={`Количество, ${l.name}`} className={fieldClass} /><span className="text-neutral-500">{u.label}</span></div>
        <input type="hidden" name={`qty_${l.id}`} value={qty === "" ? "" : String(round6(Number(qty) * u.mult))} />
      </td>
      <td className="pr-3">
        <div className="flex items-center gap-2"><input type="number" min="0" step="any" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} required aria-label={`Цена, ${l.name}`} className={fieldClass} /><span className="whitespace-nowrap text-neutral-500">/ {u.label}</span></div>
        <input type="hidden" name={`cost_${l.id}`} value={cost === "" ? "" : String(round6(Number(cost) / u.mult))} />
      </td>
      <td><input name={`exp_${l.id}`} type="date" defaultValue={l.expiresAt} className={fieldClass} /></td>
    </tr>
  );
}

export function ReceiveForm({ action, purchaseId, lines }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>; purchaseId: string; lines: ReceiveLine[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="id" value={purchaseId} />
      <h2 className="text-lg font-bold">Приёмка товара</h2>
      <p className="text-sm text-neutral-500">Проверьте фактическое количество, цену и срок годности и поправьте, если пришло не то, что заказывали. Количество в кг, л или штуках, цена за 1 кг, 1 л или 1 шт.</p>
      <table className="w-full text-sm max-md:block max-md:overflow-x-auto">
        <thead><tr className="text-left text-neutral-500"><th className="py-1">Ингредиент</th><th>Количество</th><th>Цена за 1 кг / л / шт, UZS</th><th>Срок годности</th></tr></thead>
        <tbody>
          {lines.map((l) => <ReceiveRow key={l.id} l={l} />)}
        </tbody>
      </table>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Принимаем…" : "Принять на склад"}</button>
    </form>
  );
}
