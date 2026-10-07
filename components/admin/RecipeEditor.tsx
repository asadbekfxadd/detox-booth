"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { RecipeState } from "@/app/admin/recipes/actions";
import { quickCreateIngredientAction } from "@/app/admin/ingredients/actions";
import { money, pct } from "@/lib/format";
import { UNIT_CHOICES, bigUnit, fmtQty, portionsFrom, smallLabel } from "@/lib/ingredient-units";

type Ing = { id: string; name: string; unit: string; cost: number | null; stock: number };
type Row = { ingredientId: string; quantity: string };
const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";

export function RecipeEditor({ ingredients, initial, price, action }: {
  ingredients: Ing[]; initial: { ingredientId: string; quantity: number }[]; price: number;
  action: (prev: RecipeState, fd: FormData) => Promise<RecipeState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [list, setList] = useState<Ing[]>(ingredients);
  const [rows, setRows] = useState<Row[]>(initial.map((r) => ({ ingredientId: r.ingredientId, quantity: String(r.quantity) })));
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", unit: "G", price: "" });
  const [createError, setCreateError] = useState("");
  const [busy, startCreate] = useTransition();
  const byId = new Map(list.map((i) => [i.id, i]));
  const free = list.filter((i) => !rows.some((r) => r.ingredientId === i.id));
  const showCost = list.some((i) => i.cost != null);

  const qtyOf = (r: Row) => Number(r.quantity) || 0;
  const lineCost = (r: Row) => { const ing = byId.get(r.ingredientId); return ing?.cost != null && qtyOf(r) > 0 ? ing.cost * qtyOf(r) : 0; };
  const total = rows.reduce((a, r) => a + lineCost(r), 0);
  const filled = rows.filter((r) => qtyOf(r) > 0);
  const portions = filled.length ? Math.min(...filled.map((r) => portionsFrom(byId.get(r.ingredientId)?.stock ?? 0, qtyOf(r)))) : null;
  const short = filled.filter((r) => (byId.get(r.ingredientId)?.stock ?? 0) < qtyOf(r)).map((r) => byId.get(r.ingredientId)?.name ?? "?");

  function create() {
    setCreateError("");
    startCreate(async () => {
      const res = await quickCreateIngredientAction(draft);
      if ("error" in res) { setCreateError(res.error); return; }
      setList((l) => [...l, res.ingredient]);
      setRows((rs) => [...rs, { ingredientId: res.ingredient.id, quantity: "" }]);
      setDraft({ name: "", unit: draft.unit, price: "" });
      setCreating(false);
    });
  }

  return (
    <form action={formAction} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="items" value={JSON.stringify(rows.map((r) => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })))} />
      <p className="text-sm text-neutral-600">Сколько каждого ингредиента уходит на <b>одну порцию</b>. Например, для смузи: клубника 30 г, банан 50 г, киви 20 г. При каждой продаже это количество списывается со склада.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="py-1">Ингредиент</th><th>На порцию</th><th className="text-right">На складе</th><th className="text-right">Хватит на</th>{showCost && <th className="text-right">Стоимость</th>}<th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-neutral-500">Рецепт пуст. Добавьте ингредиенты ниже.</td></tr>}
            {rows.map((r, idx) => {
              const ing = byId.get(r.ingredientId);
              const stock = ing?.stock ?? 0;
              const left = qtyOf(r) > 0 ? portionsFrom(stock, qtyOf(r)) : null;
              return (
                <tr key={r.ingredientId} className="border-t border-neutral-100">
                  <td className="py-2 font-medium">{ing?.name ?? "—"}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" step="any" value={r.quantity} placeholder="30" className={`${input} w-24`} aria-label={`${ing?.name}: количество на порцию`}
                        onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} />
                      <span className="text-neutral-500">{smallLabel(ing?.unit ?? "")}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-right text-neutral-600">{fmtQty(ing?.unit ?? "", stock)}</td>
                  <td className={`whitespace-nowrap text-right ${left === 0 ? "font-semibold text-red-700" : ""}`}>{left == null ? "—" : `${left} порц.`}</td>
                  {showCost && <td className="text-right">{money(lineCost(r))}</td>}
                  <td className="text-right"><button type="button" onClick={() => setRows(rows.filter((_, i) => i !== idx))} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-red-700 hover:bg-neutral-50">Убрать</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select id="add" defaultValue="" className={input}
          onChange={(e) => { if (e.target.value) { setRows([...rows, { ingredientId: e.target.value, quantity: "" }]); e.target.value = ""; } }}>
          <option value="">+ Добавить ингредиент…</option>
          {free.map((i) => <option key={i.id} value={i.id}>{i.name} ({smallLabel(i.unit)})</option>)}
        </select>
        <button type="button" onClick={() => setCreating(!creating)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-green-800 hover:bg-neutral-50">{creating ? "Отмена" : "Нет в списке? Создать новый"}</button>
      </div>

      {creating && (
        <div className="space-y-3 rounded-xl border border-green-200 bg-green-50/40 p-4">
          <p className="text-sm font-semibold">Новый ингредиент</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm"><span className="mb-1 block text-neutral-600">Название</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Клубника" className={`${input} w-full`} /></label>
            <label className="block text-sm"><span className="mb-1 block text-neutral-600">Как считаем</span>
              <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className={`${input} w-full`}>
                {UNIT_CHOICES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select></label>
            <label className="block text-sm"><span className="mb-1 block text-neutral-600">Цена за 1 {bigUnit(draft.unit).label}, UZS</span>
              <input type="number" min="0" step="any" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="60000" className={`${input} w-full`} /></label>
          </div>
          {createError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</p>}
          <div className="flex items-center gap-3">
            <button type="button" onClick={create} disabled={busy || draft.name.trim().length < 2} className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">{busy ? "Создаём…" : "Создать и добавить в рецепт"}</button>
            <span className="text-xs text-neutral-500">Остальное (категорию, минимальный остаток, срок) можно дополнить в разделе «Ингредиенты».</span>
          </div>
        </div>
      )}

      {filled.length > 0 && (
        <div className="space-y-2 rounded-xl bg-[#f7f3ea] p-4 text-sm">
          {showCost && (
            <>
              <p>Себестоимость порции: <b>{money(total)}</b></p>
              <p>Цена продажи: <b>{money(price)}</b> · Маржа: <b>{price ? pct(((price - total) / price) * 100) : "—"}</b></p>
            </>
          )}
          <p>Из текущих остатков можно приготовить: <b className={portions === 0 ? "text-red-700" : ""}>{portions} порц.</b></p>
          {short.length > 0 && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-amber-900">
              Не хватает на складе: <b>{short.join(", ")}</b>. Пока их нет, на сайте этот продукт будет с пометкой «Скоро вернём», а на кассе «Нет в наличии». Сначала <Link href="/admin/inventory/receive" className="underline">оформите приход</Link>.
            </p>
          )}
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
