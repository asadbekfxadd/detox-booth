"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { RecipeState } from "@/app/admin/recipes/actions";
import { quickCreateIngredientAction } from "@/app/admin/ingredients/actions";
import { money, pct } from "@/lib/format";
import { UNIT_CHOICES, bigUnit, fmtStock, portionsFrom, smallLabel } from "@/lib/ingredient-units";
import { mlOf, pickReference, sizeRatio } from "@/lib/recipe-size";

type Ing = { id: string; name: string; unit: string; cost: number | null; stock: number };
type Item = { ingredientId: string; quantity: number };
type SizeIn = { id: string; name: string; price: number; items: Item[] };
/** Размер (колонка таблицы): optionId есть у уже сохранённых, у новых null */
type Col = { key: string; optionId: string | null; name: string; price: string };
/** Строка таблицы: ингредиент и его граммовка по каждому размеру (q[key размера]) */
type Row = { ingredientId: string; q: Record<string, string> };

const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";
const PRESETS = ["200 мл", "250 мл", "300 мл", "330 мл", "400 мл", "450 мл", "500 мл", "700 мл", "1 л"];
const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: string | undefined) => Number(v) || 0;

export function RecipeEditor({ ingredients, initial, sizes, product, action }: {
  ingredients: Ing[]; initial: Item[];
  /** Размеры продукта: у каждого своё название, цена и граммовка. null: размеров нет, рецепт один. */
  sizes: SizeIn[] | null;
  product: { name: string; price: number; volumeMl: number | null };
  action: (prev: RecipeState, fd: FormData) => Promise<RecipeState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [list, setList] = useState<Ing[]>(ingredients);
  const hadSizes = !!sizes;
  const [name, setName] = useState(product.name);
  const [cols, setCols] = useState<Col[]>(() => sizes
    ? sizes.map((s) => ({ key: s.id, optionId: s.id, name: s.name, price: String(s.price) }))
    : [{ key: "base", optionId: null, name: product.volumeMl ? `${product.volumeMl} мл` : "Стандарт", price: String(product.price) }]);
  const [rows, setRows] = useState<Row[]>(() => {
    const src: { key: string; items: Item[] }[] = sizes ? sizes.map((s) => ({ key: s.id, items: s.items })) : [{ key: "base", items: initial }];
    const order: string[] = [];
    for (const c of src) for (const i of c.items) if (!order.includes(i.ingredientId)) order.push(i.ingredientId);
    return order.map((id) => ({ ingredientId: id, q: Object.fromEntries(src.map((c) => [c.key, String(c.items.find((i) => i.ingredientId === id)?.quantity ?? "")])) }));
  });
  const [seq, setSeq] = useState(1);
  const [customSize, setCustomSize] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", unit: "G", price: "" });
  const [createError, setCreateError] = useState("");
  const [busy, startCreate] = useTransition();
  // цена каждого ингредиента за 1 кг/л/шт: можно менять прямо здесь
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(ingredients.filter((i) => i.cost != null).map((i) => [i.id, String(Math.round(i.cost! * bigUnit(i.unit).factor * 100) / 100)])));
  const byId = new Map(list.map((i) => [i.id, i]));
  const free = list.filter((i) => !rows.some((r) => r.ingredientId === i.id));
  const showCost = list.some((i) => i.cost != null);
  const sized = cols.length >= 2;
  const only = cols.length === 1;

  const qty = (r: Row, key: string) => num(r.q[key]);
  const emptyQ = () => Object.fromEntries(cols.map((c) => [c.key, ""]));
  /** Цена одной базовой единицы (за 1 г, мл, шт) с учётом того, что вписано в таблице */
  const unitCost = (id: string) => { const ing = byId.get(id); if (!ing || ing.cost == null) return 0; const v = prices[id]; return v === undefined || v === "" ? ing.cost : num(v) / bigUnit(ing.unit).factor; };
  const changedPrices = list.filter((i) => i.cost != null && prices[i.id] !== undefined && prices[i.id] !== "" && Math.abs(num(prices[i.id]) - Math.round(i.cost * bigUnit(i.unit).factor * 100) / 100) > 0.004)
    .map((i) => ({ ingredientId: i.id, price: num(prices[i.id]) }));

  const payload = (c: Col): Item[] => rows.filter((r) => qty(r, c.key) > 0).map((r) => ({ ingredientId: r.ingredientId, quantity: qty(r, c.key) }));
  /** Итоги по каждому размеру: себестоимость, цена, маржа, сколько порций из остатков, чего не хватает */
  const summary = cols.map((c) => {
    const filled = rows.filter((r) => qty(r, c.key) > 0);
    const cost = filled.reduce((a, r) => a + unitCost(r.ingredientId) * qty(r, c.key), 0);
    const portions = filled.length ? Math.min(...filled.map((r) => portionsFrom(byId.get(r.ingredientId)?.stock ?? 0, qty(r, c.key)))) : null;
    const short = filled.filter((r) => (byId.get(r.ingredientId)?.stock ?? 0) < qty(r, c.key)).map((r) => byId.get(r.ingredientId)?.name ?? "?");
    return { col: c, count: filled.length, cost, price: num(c.price), portions, short };
  });
  const anyFilled = summary.some((x) => x.count > 0);
  const shortAll = [...new Set(summary.flatMap((x) => x.short))];
  const dupNames = sized && new Set(cols.map((c) => c.name.trim().toLowerCase())).size !== cols.length;
  const label = (c: Col) => (sized ? c.name.trim() || "Без названия" : "порцию");

  function setCol(key: string, patch: Partial<Col>) { setCols((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c))); }

  /** Новый размер: граммы и цена копируются с ближайшего по объёму и пересчитываются пропорционально, дальше правятся руками */
  function addSize(rawName: string) {
    const n = rawName.trim();
    if (!n) return;
    if (cols.some((c) => c.name.trim().toLowerCase() === n.toLowerCase())) return;
    const key = `n${seq}`;
    setSeq(seq + 1);
    const ref = pickReference(cols, n);
    const k = ref ? sizeRatio(ref.name, n) : 1;
    const price = ref ? Math.round((num(ref.price) * k) / 500) * 500 : 0;
    setCols([...cols, { key, optionId: null, name: n, price: String(price || "") }]);
    setRows(rows.map((r) => ({ ...r, q: { ...r.q, [key]: ref && r.q[ref.key] ? String(round1(num(r.q[ref.key]) * k)) : "" } })));
    setCustomSize("");
  }
  function removeSize(key: string) {
    if (cols.length < 2) return;
    setCols(cols.filter((c) => c.key !== key));
    setRows(rows.map((r) => { const q = { ...r.q }; delete q[key]; return { ...r, q }; }));
  }
  function create() {
    setCreateError("");
    startCreate(async () => {
      const res = await quickCreateIngredientAction(draft);
      if ("error" in res) { setCreateError(res.error); return; }
      const created = res.ingredient;
      setList((l) => [...l, created]);
      if (created.cost != null) setPrices((p) => ({ ...p, [created.id]: String(Math.round(created.cost! * bigUnit(created.unit).factor * 100) / 100) }));
      setRows((rs) => [...rs, { ingredientId: created.id, q: emptyQ() }]);
      setDraft({ name: "", unit: draft.unit, price: "" });
      setCreating(false);
    });
  }

  const sendSizes = sized || hadSizes;
  const sortedCols = [...cols].sort((a, b) => num(a.price) - num(b.price));
  const free2 = PRESETS.filter((p) => !cols.some((c) => c.name.trim().toLowerCase() === p.toLowerCase() || (mlOf(c.name) != null && mlOf(c.name) === mlOf(p))));

  return (
    <form action={formAction} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="name" value={name} />
      {sendSizes
        ? <input type="hidden" name="sizes" value={JSON.stringify(sortedCols.map((c) => ({ optionId: c.optionId, name: c.name, price: num(c.price), items: payload(c) })))} />
        : <><input type="hidden" name="items" value={JSON.stringify(payload(cols[0]))} /><input type="hidden" name="price" value={cols[0].price} /></>}
      {changedPrices.length > 0 && <input type="hidden" name="prices" value={JSON.stringify(changedPrices)} />}

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Название продукта</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${input} w-full text-base font-semibold`} /></label>
        {only && (
          <label className="block text-sm"><span className="mb-1 block text-neutral-600">Цена продажи, UZS</span>
            <input type="number" min="0" step="any" value={cols[0].price} onChange={(e) => setCol(cols[0].key, { price: e.target.value })} className={`${input} w-40`} aria-label="Цена продажи" /></label>
        )}
      </div>

      <div className="space-y-2 rounded-xl bg-[#f7f3ea] p-4">
        <p className="text-sm font-semibold">Размеры (объёмы)</p>
        <p className="text-xs text-neutral-600">
          {sized
            ? <>Покупатель выбирает размер при заказе. У каждого размера своя цена и своя граммовка. Лишний размер уберите крестиком, нужный добавьте кнопкой: граммы и цена подставятся пропорционально, потом поправьте вручную. Самый дешёвый размер выбран по умолчанию.</>
            : <>Сейчас у продукта один размер. Нужны несколько объёмов, например 250 и 500 мл? Нажмите на размер ниже: граммы и цена подставятся пропорционально, потом поправьте вручную.</>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {free2.map((p) => <button key={p} type="button" onClick={() => addSize(p)} className="rounded-full border border-green-700/30 bg-white px-3 py-1 text-sm text-green-800 hover:bg-green-50">+ {p}</button>)}
          <input value={customSize} onChange={(e) => setCustomSize(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(customSize); } }} placeholder="Свой: 350 мл" aria-label="Свой размер" className={`${input} w-36`} />
          <button type="button" onClick={() => addSize(customSize)} disabled={!customSize.trim()} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50">Добавить размер</button>
        </div>
        {dupNames && <p className="text-xs text-red-700">Названия размеров не должны повторяться.</p>}
      </div>

      <p className="text-sm text-neutral-600">
        Сколько каждого ингредиента уходит на <b>одну порцию{sized ? " каждого размера" : ""}</b>: именно это списывается со склада при продаже и входит в себестоимость.
        {showCost && <> Цену ингредиента за кг/л/шт тоже можно менять прямо здесь.</>} Если ингредиент размеру не нужен, оставьте поле пустым.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500">
            <th className="py-1 align-bottom">Ингредиент</th>
            {cols.map((c) => (
              <th key={c.key} className="pr-2 align-bottom">
                {sized ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <input value={c.name} onChange={(e) => setCol(c.key, { name: e.target.value })} aria-label="Название размера" className={`${input} w-28 font-semibold text-neutral-800`} />
                      <button type="button" onClick={() => removeSize(c.key)} aria-label={`Убрать размер ${c.name}`} title="Убрать размер" className="rounded-lg border border-neutral-200 px-2 py-2 text-xs text-red-700 hover:bg-red-50">✕</button>
                    </div>
                    <div className="flex items-center gap-1 font-normal">
                      <input type="number" min="0" step="any" value={c.price} onChange={(e) => setCol(c.key, { price: e.target.value })} aria-label={`Цена ${c.name}`} placeholder="Цена" className={`${input} w-28 text-neutral-800`} /><span className="text-xs">UZS</span>
                    </div>
                  </div>
                ) : "На порцию"}
              </th>
            ))}
            {showCost && <th className="text-right align-bottom">Цена за 1 кг/л/шт, UZS</th>}
            <th className="text-right align-bottom">На складе</th><th />
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length + 4} className="py-6 text-center text-neutral-500">Рецепт пуст. Добавьте ингредиенты ниже.</td></tr>}
            {rows.map((r, idx) => {
              const ing = byId.get(r.ingredientId);
              return (
                <tr key={r.ingredientId} className="border-t border-neutral-100">
                  <td className="py-2 font-medium">{ing?.name ?? "—"}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="pr-2">
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" step="any" value={r.q[c.key] ?? ""} placeholder="30" className={`${input} w-24`} aria-label={`${ing?.name}: количество на ${label(c)}`}
                          onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, q: { ...x.q, [c.key]: e.target.value } } : x)))} />
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
            <div key={x.col.key} className="space-y-0.5">
              {sized && <p className="font-semibold">{x.col.name.trim() || "Без названия"}</p>}
              {showCost && <p>Себестоимость порции: <b>{money(x.cost)}</b> · Цена продажи: <b>{money(x.price)}</b> · Маржа: <b>{x.price ? pct(((x.price - x.cost) / x.price) * 100) : "—"}</b></p>}
              <p>Из текущих остатков можно приготовить: <b className={x.portions === 0 ? "text-red-700" : ""}>{x.portions} порц.</b></p>
            </div>
          ))}
          {sized && summary.some((x) => x.count === 0) && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">Заполните граммовку для каждого размера: {summary.filter((x) => x.count === 0).map((x) => x.col.name.trim() || "Без названия").join(", ")}.</p>}
          {shortAll.length > 0 && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-amber-900">
              Не хватает на складе: <b>{shortAll.join(", ")}</b>. Пока их нет, на сайте этот продукт будет с пометкой «Скоро вернём», а на кассе «Нет в наличии». Сначала <Link href="/admin/inventory/receive" className="underline">оформите приход</Link>.
            </p>
          )}
        </div>
      )}

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || dupNames} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Сохраняем…" : "Сохранить рецепт"}</button>
        <Link href="/admin/recipes" className="rounded-xl border border-neutral-200 px-6 py-2.5">Отмена</Link>
        <span className="text-xs text-neutral-500">Фото, описание и категорию меняйте в <Link href="/admin/products" className="underline">карточке продукта</Link>.</span>
      </div>
    </form>
  );
}
