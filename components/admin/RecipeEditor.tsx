"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { RecipeState } from "@/app/admin/recipes/actions";
import { quickCreateIngredientAction } from "@/app/admin/ingredients/actions";
import { money, pct } from "@/lib/format";
import { UNIT_CHOICES, bigUnit, fmtStock, portionsFrom, smallLabel } from "@/lib/ingredient-units";

type Ing = { id: string; name: string; unit: string; cost: number | null; stock: number };
type Size = { id: string; name: string; priceDelta: number; items: { ingredientId: string; quantity: number }[] };
/** Одна строка таблицы: ингредиент и граммовка по каждому размеру (q[id размера]) */
type Row = { ingredientId: string; q: Record<string, string> };
const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";
const BASE = "base";

export function RecipeEditor({ ingredients, initial, sizes, sizeName, price, action }: {
  ingredients: Ing[]; initial: { ingredientId: string; quantity: number }[]; price: number;
  /** Размеры продукта («Объём»: 300 мл, 500 мл): у каждого своя граммовка. null: продукт без размеров, рецепт один. */
  sizes: Size[] | null; sizeName: string | null;
  action: (prev: RecipeState, fd: FormData) => Promise<RecipeState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [list, setList] = useState<Ing[]>(ingredients);
  // столбцы: размеры продукта или один общий «На порцию»
  const cols: Size[] = sizes ?? [{ id: BASE, name: "На порцию", priceDelta: 0, items: initial }];
  const [rows, setRows] = useState<Row[]>(() => {
    const order: string[] = [];
    for (const c of cols) for (const i of c.items) if (!order.includes(i.ingredientId)) order.push(i.ingredientId);
    return order.map((id) => ({ ingredientId: id, q: Object.fromEntries(cols.map((c) => [c.id, String(c.items.find((i) => i.ingredientId === id)?.quantity ?? "")])) }));
  });
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", unit: "G", price: "" });
  const [createError, setCreateError] = useState("");
  const [busy, startCreate] = useTransition();
  // цена каждого ингредиента за 1 кг/л/шт: можно менять прямо здесь
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(ingredients.filter((i) => i.cost != null).map((i) => [i.id, String(Math.round(i.cost! * bigUnit(i.unit).factor * 100) / 100)])));
  // название и цена продажи каждого размера: тоже редактируются здесь
  const [sizeEd, setSizeEd] = useState<Record<string, { name: string; price: string }>>(() => Object.fromEntries(cols.map((c) => [c.id, { name: c.name, price: String(price + c.priceDelta) }])));
  const byId = new Map(list.map((i) => [i.id, i]));
  const free = list.filter((i) => !rows.some((r) => r.ingredientId === i.id));
  const showCost = list.some((i) => i.cost != null);

  const qty = (r: Row, col: string) => Number(r.q[col]) || 0;
  /** Цена одной базовой единицы (за 1 г, мл, шт) с учётом того, что вписано в таблице */
  const unitCost = (id: string) => { const ing = byId.get(id); if (!ing || ing.cost == null) return 0; const v = prices[id]; return v === undefined || v === "" ? ing.cost : (Number(v) || 0) / bigUnit(ing.unit).factor; };
  const sizeLabel = (c: Size) => sizeEd[c.id]?.name?.trim() || c.name;
  const sizePrice = (c: Size) => { const v = sizeEd[c.id]?.price; return v === undefined || v === "" ? price + c.priceDelta : Number(v) || 0; };
  const changedPrices = list.filter((i) => i.cost != null && prices[i.id] !== undefined && prices[i.id] !== "" && Math.abs(Number(prices[i.id]) - Math.round(i.cost * bigUnit(i.unit).factor * 100) / 100) > 0.004)
    .map((i) => ({ ingredientId: i.id, price: Number(prices[i.id]) }));
  const emptyQ = () => Object.fromEntries(cols.map((c) => [c.id, ""]));
  /** Итоги по каждому размеру: себестоимость, цена, сколько порций из остатков, чего не хватает */
  const summary = cols.map((c) => {
    const filled = rows.filter((r) => qty(r, c.id) > 0);
    const cost = filled.reduce((a, r) => a + unitCost(r.ingredientId) * qty(r, c.id), 0);
    const portions = filled.length ? Math.min(...filled.map((r) => portionsFrom(byId.get(r.ingredientId)?.stock ?? 0, qty(r, c.id)))) : null;
    const short = filled.filter((r) => (byId.get(r.ingredientId)?.stock ?? 0) < qty(r, c.id)).map((r) => byId.get(r.ingredientId)?.name ?? "?");
    return { col: c, count: filled.length, cost, price: sizePrice(c), portions, short };
  });
  const anyFilled = summary.some((x) => x.count > 0);
  const shortAll = [...new Set(summary.flatMap((x) => x.short))];
  const payload = (c: Size) => rows.filter((r) => qty(r, c.id) > 0).map((r) => ({ ingredientId: r.ingredientId, quantity: qty(r, c.id) }));

  function create() {
    setCreateError("");
    startCreate(async () => {
      const res = await quickCreateIngredientAction(draft);
      if ("error" in res) { setCreateError(res.error); return; }
      setList((l) => [...l, res.ingredient]);
      const created = res.ingredient;
      if (created.cost != null) setPrices((p) => ({ ...p, [created.id]: String(Math.round(created.cost! * bigUnit(created.unit).factor * 100) / 100) }));
      setRows((rs) => [...rs, { ingredientId: res.ingredient.id, q: emptyQ() }]);
      setDraft({ name: "", unit: draft.unit, price: "" });
      setCreating(false);
    });
  }

  return (
    <form action={formAction} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="items" value={JSON.stringify(payload(cols[0]))} />
      {changedPrices.length > 0 && <input type="hidden" name="prices" value={JSON.stringify(changedPrices)} />}
      {sizes && <input type="hidden" name="sizeEdits" value={JSON.stringify(cols.map((c) => ({ optionId: c.id, name: sizeLabel(c), price: sizePrice(c) })))} />}
      {sizes && <input type="hidden" name="sizes" value={JSON.stringify(cols.map((c) => ({ optionId: c.id, items: payload(c) })))} />}
      <p className="text-sm text-neutral-600">
        {sizes
          ? <>Сколько каждого ингредиента уходит на <b>одну порцию каждого размера ({sizeName ?? "Объём"})</b>. Впишите свою граммовку в каждую колонку: именно она списывается со склада при продаже этого размера и входит в себестоимость. Название размера, его цену и цену ингредиента за кг/л/шт тоже можно менять прямо здесь. Если ингредиент в размере не нужен, оставьте пусто.</>
          : <>Сколько каждого ингредиента уходит на <b>одну порцию</b>. Например, для смузи: клубника 30 г, банан 50 г, киви 20 г. При каждой продаже это количество списывается со склада.</>}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500">
            <th className="py-1">Ингредиент</th>
            {cols.map((c) => <th key={c.id} className="align-bottom pr-2">
              {sizes ? (
                <div className="space-y-1">
                  <input value={sizeEd[c.id]?.name ?? ""} onChange={(e) => setSizeEd({ ...sizeEd, [c.id]: { ...sizeEd[c.id], name: e.target.value } })} aria-label="Название размера" className={`${input} w-28 font-semibold text-neutral-800`} />
                  {showCost && <div className="flex items-center gap-1 font-normal"><input type="number" min="0" step="any" value={sizeEd[c.id]?.price ?? ""} onChange={(e) => setSizeEd({ ...sizeEd, [c.id]: { ...sizeEd[c.id], price: e.target.value } })} aria-label={`Цена ${sizeLabel(c)}`} className={`${input} w-28 text-neutral-800`} /><span className="text-xs">UZS</span></div>}
                </div>
              ) : "На порцию"}
            </th>)}
            {showCost && <th className="text-right">Цена за 1 кг/л/шт, UZS</th>}
            <th className="text-right">На складе</th><th />
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length + 4} className="py-6 text-center text-neutral-500">Рецепт пуст. Добавьте ингредиенты ниже.</td></tr>}
            {rows.map((r, idx) => {
              const ing = byId.get(r.ingredientId);
              return (
                <tr key={r.ingredientId} className="border-t border-neutral-100">
                  <td className="py-2 font-medium">{ing?.name ?? "—"}</td>
                  {cols.map((c) => (
                    <td key={c.id} className="pr-2">
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" step="any" value={r.q[c.id] ?? ""} placeholder="30" className={`${input} w-24`} aria-label={`${ing?.name}: количество на ${sizes ? sizeLabel(c) : "порцию"}`}
                          onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, q: { ...x.q, [c.id]: e.target.value } } : x)))} />
                        <span className="text-neutral-500">{smallLabel(ing?.unit ?? "")}</span>
                      </div>
                    </td>
                  ))}
                  {showCost && (
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input type="number" min="0" step="any" value={prices[r.ingredientId] ?? ""} placeholder="0" className={`${input} w-28 text-right`} aria-label={`${ing?.name}: цена за 1 ${bigUnit(ing?.unit ?? "").label}`}
                          onChange={(e) => setPrices({ ...prices, [r.ingredientId]: e.target.value })} />
                        <span className="text-xs text-neutral-500">/{bigUnit(ing?.unit ?? "").label}</span>
                      </div>
                    </td>
                  )}
                  <td className="whitespace-nowrap text-right text-neutral-600">{fmtStock(ing?.unit ?? "", ing?.stock ?? 0)}</td>
                  <td className="text-right"><button type="button" onClick={() => setRows(rows.filter((_, i) => i !== idx))} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-red-700 hover:bg-neutral-50">Убрать</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select id="add" defaultValue="" className={input}
          onChange={(e) => { if (e.target.value) { setRows([...rows, { ingredientId: e.target.value, q: emptyQ() }]); e.target.value = ""; } }}>
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

      {anyFilled && (
        <div className="space-y-3 rounded-xl bg-[#f7f3ea] p-4 text-sm">
          {summary.map((x) => x.count > 0 && (
            <div key={x.col.id} className="space-y-0.5">
              {sizes && <p className="font-semibold">{sizeLabel(x.col)}</p>}
              {showCost && <p>Себестоимость порции: <b>{money(x.cost)}</b> · Цена продажи: <b>{money(x.price)}</b> · Маржа: <b>{x.price ? pct(((x.price - x.cost) / x.price) * 100) : "—"}</b></p>}
              <p>Из текущих остатков можно приготовить: <b className={x.portions === 0 ? "text-red-700" : ""}>{x.portions} порц.</b></p>
            </div>
          ))}
          {sizes && summary.some((x) => x.count === 0) && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">Заполните граммовку для каждого размера: {summary.filter((x) => x.count === 0).map((x) => sizeLabel(x.col)).join(", ")}.</p>}
          {shortAll.length > 0 && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-amber-900">
              Не хватает на складе: <b>{shortAll.join(", ")}</b>. Пока их нет, на сайте этот продукт будет с пометкой «Скоро вернём», а на кассе «Нет в наличии». Сначала <Link href="/admin/inventory/receive" className="underline">оформите приход</Link>.
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
