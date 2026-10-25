"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { OpState } from "@/components/admin/ops";
import { money } from "@/lib/format";
import { UNIT_CHOICES, fmtQty, smallLabel, bigUnit } from "@/lib/ingredient-units";

type Opt = { id: string; name: string; unit: string; avgCost: number };
type Row = { ingredientId: string; quantity: string };
const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";

/** Рецепт заготовки: из чего и сколько получается. Всё правится прямо в таблице, стоимость считается на лету. */
export function PrepEditor({ action, options, initial, showCost }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>;
  options: Opt[];
  initial?: { id: string; name: string; unit: string; outputQty: number; shelfLifeDays: number | null; items: { ingredientId: string; quantity: number }[]; locked: boolean };
  showCost: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "ML");
  const [outputQty, setOutputQty] = useState(initial ? String(initial.outputQty) : "");
  const [shelf, setShelf] = useState(initial?.shelfLifeDays ? String(initial.shelfLifeDays) : "");
  const [rows, setRows] = useState<Row[]>(initial?.items.map((i) => ({ ingredientId: i.ingredientId, quantity: String(i.quantity) })) ?? []);
  const byId = new Map(options.map((o) => [o.id, o]));
  const free = options.filter((o) => o.id !== initial?.id && !rows.some((r) => r.ingredientId === o.id));
  const out = Number(outputQty) || 0;
  const total = rows.reduce((a, r) => a + (Number(r.quantity) || 0) * (byId.get(r.ingredientId)?.avgCost ?? 0), 0);
  const perUnit = out > 0 ? total / out : 0;
  const payload = { ingredientId: initial?.id ?? null, name, unit, outputQty: Number(outputQty), shelfLifeDays: shelf ? Number(shelf) : null, items: rows.filter((r) => Number(r.quantity) > 0).map((r) => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })) };

  return (
    <form action={formAction} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Название заготовки</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Апельсиновый фреш (заготовка)" className={`${input} w-full text-base font-semibold`} /></label>
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Как считаем</span>
          {initial?.locked
            ? <p className="py-2 font-medium">{UNIT_CHOICES.find((u) => u.value === unit)?.label ?? unit}</p>
            : <select value={unit} onChange={(e) => setUnit(e.target.value)} className={input}>{UNIT_CHOICES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</select>}
        </label>
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Срок годности, дней</span>
          <input type="number" min="1" step="1" value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="2" className={`${input} w-28`} /></label>
      </div>

      <label className="block text-sm"><span className="mb-1 block text-neutral-600">Сколько заготовки получается из состава ниже ({smallLabel(unit)})</span>
        <div className="flex items-center gap-2">
          <input type="number" min="0" step="any" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} placeholder="5000" className={`${input} w-40`} aria-label="Сколько получается" />
          <span className="text-neutral-500">{smallLabel(unit)}</span>
          {out > 0 && <span className="text-xs text-neutral-500">= {fmtQty(unit, out)}</span>}
        </div></label>

      <p className="text-sm text-neutral-600">
        Впишите, сколько сырья берёте со склада (брутто), и сколько готового получилось. Потери при обработке уже учтены в этом выходе:
        например, 11 000 г апельсина → 5 000 мл сока. Из заготовки потом можно готовить напитки, она лежит на складе как обычный продукт. Нужен другой объём: в акте приготовления всё пересчитается пропорционально.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="py-1">Сырьё</th><th>Берём со склада</th>{showCost && <th className="text-right">Стоимость</th>}<th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-neutral-500">Состав пуст. Добавьте сырьё ниже.</td></tr>}
            {rows.map((r, idx) => {
              const o = byId.get(r.ingredientId);
              return (
                <tr key={r.ingredientId} className="border-t border-neutral-100">
                  <td className="py-2 font-medium">{o?.name ?? "—"}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" step="any" value={r.quantity} className={`${input} w-28`} aria-label={`${o?.name}: сколько берём`}
                        onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} />
                      <span className="text-neutral-500">{smallLabel(o?.unit ?? "")}</span>
                    </div>
                  </td>
                  {showCost && <td className="text-right text-neutral-600">{money((Number(r.quantity) || 0) * (o?.avgCost ?? 0))}</td>}
                  <td className="text-right"><button type="button" onClick={() => setRows(rows.filter((_, i) => i !== idx))} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-red-700 hover:bg-neutral-50">Убрать</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <select value="" aria-label="Добавить сырьё" className={input}
        onChange={(e) => { if (e.target.value) setRows([...rows, { ingredientId: e.target.value, quantity: "" }]); }}>
        <option value="">+ Добавить сырьё…</option>
        {free.map((o) => <option key={o.id} value={o.id}>{o.name} ({smallLabel(o.unit)})</option>)}
      </select>

      {showCost && out > 0 && total > 0 && (
        <div className="rounded-xl bg-[#f7f3ea] p-4 text-sm">
          <p>Сырьё на весь выход: <b>{money(total)}</b> · 1 {bigUnit(unit).label}: <b>{money(perUnit * bigUnit(unit).factor)}</b></p>
          <p className="text-xs text-neutral-500">Оценка по средним ценам. В акте приготовления считается по реальным партиям.</p>
        </div>
      )}

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Сохраняем…" : initial ? "Сохранить рецепт заготовки" : "Создать заготовку"}</button>
        <Link href="/admin/prep" className="rounded-xl border border-neutral-200 px-6 py-2.5">Отмена</Link>
      </div>
    </form>
  );
}
