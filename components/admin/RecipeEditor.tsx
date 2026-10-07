"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { RecipeState } from "@/app/admin/recipes/actions";
import { money, pct } from "@/lib/format";

type Ing = { id: string; name: string; unit: string; cost: number | null };
type Row = { ingredientId: string; quantity: string };
const UNIT: Record<string, string> = { G: "г", KG: "кг", ML: "мл", L: "л", PC: "шт" };
const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";

export function RecipeEditor({ ingredients, initial, price, action }: {
  ingredients: Ing[]; initial: { ingredientId: string; quantity: number }[]; price: number;
  action: (prev: RecipeState, fd: FormData) => Promise<RecipeState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [rows, setRows] = useState<Row[]>(initial.map((r) => ({ ingredientId: r.ingredientId, quantity: String(r.quantity) })));
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const free = ingredients.filter((i) => !rows.some((r) => r.ingredientId === i.id));
  const showCost = ingredients.some((i) => i.cost != null);

  const lineCost = (r: Row) => {
    const ing = byId.get(r.ingredientId); const q = Number(r.quantity);
    return ing?.cost != null && q > 0 ? ing.cost * q : 0;
  };
  const total = rows.reduce((a, r) => a + lineCost(r), 0);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="items" value={JSON.stringify(rows.map((r) => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })))} />
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-500"><th className="py-1">Ингредиент</th><th>Количество</th>{showCost && <th className="text-right">Стоимость</th>}<th /></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-neutral-500">Рецепт пуст. Добавьте ингредиенты ниже.</td></tr>}
          {rows.map((r, idx) => {
            const ing = byId.get(r.ingredientId);
            return (
              <tr key={r.ingredientId} className="border-t border-neutral-100">
                <td className="py-2 font-medium">{ing?.name ?? "—"}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" step="any" value={r.quantity} className={`${input} w-28`}
                      onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} />
                    <span className="text-neutral-500">{UNIT[ing?.unit ?? ""] ?? ing?.unit}</span>
                  </div>
                </td>
                {showCost && <td className="text-right">{money(lineCost(r))}</td>}
                <td className="text-right"><button type="button" onClick={() => setRows(rows.filter((_, i) => i !== idx))} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-red-700 hover:bg-neutral-50">Убрать</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-2">
        <select id="add" defaultValue="" className={input}
          onChange={(e) => { if (e.target.value) { setRows([...rows, { ingredientId: e.target.value, quantity: "" }]); e.target.value = ""; } }}>
          <option value="">+ Добавить ингредиент…</option>
          {free.map((i) => <option key={i.id} value={i.id}>{i.name} ({UNIT[i.unit] ?? i.unit})</option>)}
        </select>
      </div>

      {showCost && (
        <div className="rounded-xl bg-[#f7f3ea] p-4 text-sm">
          <p>Себестоимость порции: <b>{money(total)}</b></p>
          <p>Цена продажи: <b>{money(price)}</b> · Маржа: <b>{price ? pct(((price - total) / price) * 100) : "—"}</b></p>
        </div>
      )}

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Сохраняем…" : "Сохранить рецепт"}</button>
        <Link href="/admin/recipes" className="rounded-xl border border-neutral-200 px-6 py-2.5">Отмена</Link>
      </div>
    </form>
  );
}
