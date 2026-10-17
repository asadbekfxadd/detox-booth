"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { LocationField, fieldClass, type OpState } from "@/components/admin/ops";
import { BASE_LABEL, bigUnit, round6 } from "@/components/admin/units";
import { parseReceiveList, type ListRow, type MissingItem } from "@/lib/receive-list";
import { UNIT_CHOICES } from "@/lib/ingredient-units";
import { quickCreateIngredientAction, type QuickIngredient } from "@/app/admin/inventory/actions";

type Ing = { id: string; name: string; unit: string; avgCost: number };
type Row = { ingredientId: string; label: string; quantity: string; unitCost: string; big: boolean; expiresAt: string };
const START_ROWS = 5;
const MAX_ROWS = 100;
const empty = (): Row => ({ ingredientId: "", label: "", quantity: "", unitCost: "", big: false, expiresAt: "" });
const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
const isBlank = (r: Row) => !r.ingredientId && !r.label.trim() && r.quantity === "" && r.expiresAt === "";

/** Приход списком: вся накладная в одной таблице и одной кнопкой. На сервер уходит базовая единица (г, мл, шт). */
export function BulkReceiveForm({ action, ingredients: initialIngredients, categories, locations, defaultLocationId, initialIngredientId }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>;
  ingredients: Ing[]; categories: string[]; locations: { id: string; name: string }[]; defaultLocationId: string;
  /** «+ Приход» из строки склада: первая строка сразу заполнена этим ингредиентом */
  initialIngredientId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [, start] = useTransition();
  // продукты, созданные прямо здесь, добавляются в этот же список: форма не перезагружается и введённое не пропадает
  const [ingredients, setIngredients] = useState<Ing[]>(initialIngredients);
  const [cats, setCats] = useState<string[]>(categories);
  const [quick, setQuick] = useState<{ idx: number; category: string; unit: string; busy: boolean; error: string | null } | null>(null);
  const [lastCategory, setLastCategory] = useState(categories.includes("Прочее") ? "Прочее" : (categories[0] ?? "Прочее"));
  const [creatingMissing, setCreatingMissing] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => {
    const rows = Array.from({ length: START_ROWS }, empty);
    const i = ingredients.find((x) => x.id === initialIngredientId);
    if (i) rows[0] = { ...empty(), ingredientId: i.id, label: `${i.name} (${BASE_LABEL[i.unit]})`, unitCost: String(round6(i.avgCost)) };
    return rows;
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [pasteInfo, setPasteInfo] = useState<{ added: number; errors: string[]; missing: MissingItem[] } | null>(null);
  const focusNext = useRef<number | null>(null);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const labelOf = (i: Ing) => `${i.name} (${BASE_LABEL[i.unit]})`;
  const byLabel = new Map(ingredients.map((i) => [labelOf(i), i]));

  // пришли из строки склада с готовым ингредиентом: сразу к количеству
  useEffect(() => { if (initialIngredientId) document.querySelector<HTMLInputElement>('input[aria-label="Количество, строка 1"]')?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focusNext.current == null) return;
    const el = document.querySelector<HTMLInputElement>(`[data-row="${focusNext.current}"][data-col="ing"]`);
    focusNext.current = null;
    el?.focus();
  });

  const set = (idx: number, patch: Partial<Row>) => setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const mult = (r: Row) => { const i = byId.get(r.ingredientId); const b = i ? bigUnit(i.unit) : null; return r.big && b ? b.mult : 1; };

  function onIngredient(idx: number, text: string) {
    const i = byLabel.get(text);
    if (!i) { set(idx, { label: text, ingredientId: "" }); return; }
    // цена по умолчанию — прежняя средняя, чтобы вводить только то, что изменилось
    set(idx, { label: text, ingredientId: i.id, big: false, unitCost: rows[idx].unitCost === "" || rows[idx].ingredientId !== i.id ? String(round6(i.avgCost)) : rows[idx].unitCost });
  }
  /** Ушли из поля с названием без выбора из списка: если это точное название существующего продукта (без учёта регистра), берём его. Похожие не подставляем: «Манго» не то же самое, что «Манго-кокос». */
  function onIngredientBlur(idx: number) {
    const r = rows[idx];
    if (r.ingredientId || !r.label.trim()) return;
    const n = r.label.trim().replace(/\s*\((г|мл|шт|кг|л)\)\s*$/i, "").toLowerCase().replace(/ё/g, "е");
    const hit = ingredients.filter((i) => i.name.toLowerCase().replace(/ё/g, "е") === n);
    if (hit.length === 1) onIngredient(idx, labelOf(hit[0]));
  }
  function toggle(idx: number, next: boolean) {
    const r = rows[idx]; const i = byId.get(r.ingredientId); const b = i ? bigUnit(i.unit) : null;
    if (!b) return;
    const k = next ? 1 / b.mult : b.mult;
    set(idx, { big: next, quantity: r.quantity === "" ? "" : String(round6(Number(r.quantity) * k)), unitCost: r.unitCost === "" ? "" : String(round6(Number(r.unitCost) / k)) });
  }
  function addRow() { setRows((r) => (r.length >= MAX_ROWS ? r : [...r, empty()])); }
  function onEnter(e: React.KeyboardEvent, idx: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (idx === rows.length - 1) addRow();
    focusNext.current = Math.min(idx + 1, MAX_ROWS - 1);
    setRows((r) => [...r]); // перерисовать, чтобы сработал фокус
  }

  function addPasted(text = paste, list: Ing[] = ingredients) {
    const res = parseReceiveList(text, list);
    const added: Row[] = res.rows.map((x: ListRow) => ({ ...x, label: labelOf(list.find((i) => i.id === x.ingredientId)!) }));
    if (added.length) setRows((r) => [...r.filter((x) => !isBlank(x)), ...added].slice(0, MAX_ROWS).concat([empty()]));
    // в поле остаются только строки с ошибками: поправьте их и добавьте ещё раз, удачные уже в таблице
    setPaste(res.failed.join("\n"));
    setPasteInfo({ added: added.length, errors: res.errors, missing: res.missing });
  }

  function registerCreated(ing: QuickIngredient): Ing {
    const x: Ing = { id: ing.id, name: ing.name, unit: ing.unit, avgCost: ing.avgCost };
    setIngredients((l) => [...l, x].sort((a, b) => a.name.localeCompare(b.name, "ru")));
    setCats((c) => (c.includes(ing.category) ? c : [...c, ing.category]));
    setLastCategory(ing.category);
    return x;
  }
  function openQuick(idx: number) {
    setQuick({ idx, category: lastCategory, unit: "G", busy: false, error: null });
  }
  async function createQuick() {
    if (!quick) return;
    const row = rows[quick.idx];
    const name = row.label.trim().replace(/\s*\((г|мл|шт|кг|л)\)\s*$/i, "");
    setQuick({ ...quick, busy: true, error: null });
    const r = await quickCreateIngredientAction({ name, category: quick.category.trim(), unit: quick.unit });
    if (!r.ok) { setQuick((q) => (q ? { ...q, busy: false, error: r.error } : q)); return; }
    const x = registerCreated(r.ingredient);
    const idx = quick.idx;
    // цену подставит сам приход (первая закупка задаёт среднюю), поэтому поле цены остаётся пустым: её нужно ввести
    set(idx, { ingredientId: x.id, label: labelOf(x), big: false });
    setQuick(null);
    setTimeout(() => document.querySelector<HTMLInputElement>(`input[aria-label="Количество, строка ${idx + 1}"]`)?.focus(), 50);
  }
  async function createMissing() {
    if (!pasteInfo?.missing.length) return;
    setCreatingMissing(true);
    let list = ingredients;
    const failed: string[] = [];
    for (const m of pasteInfo.missing) {
      const r = await quickCreateIngredientAction({ name: m.name, category: lastCategory.trim(), unit: m.unit });
      if (r.ok) list = [...list, registerCreated(r.ingredient)]; else failed.push(`«${m.name}»: ${r.error}`);
    }
    setCreatingMissing(false);
    addPasted(paste, list);
    if (failed.length) setPasteInfo((p) => (p ? { ...p, errors: [...p.errors, ...failed] } : p));
  }

  const filled = rows.filter((r) => !isBlank(r));
  const total = filled.reduce((a, r) => a + (Number(r.quantity) || 0) * (Number(r.unitCost) || 0), 0);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    if (filled.length === 0) { setLocalError("Добавьте хотя бы одну позицию"); return; }
    for (const [n, r] of rows.entries()) {
      if (isBlank(r)) continue;
      if (!r.ingredientId) { setLocalError(`Строка ${n + 1}: выберите ингредиент из списка`); return; }
      if (!(Number(r.quantity) > 0)) { setLocalError(`Строка ${n + 1}: укажите количество`); return; }
      if (r.unitCost === "") { setLocalError(`Строка ${n + 1}: укажите цену`); return; }
    }
    const items = rows.filter((r) => !isBlank(r)).map((r) => ({
      ingredientId: r.ingredientId,
      quantity: String(round6(Number(r.quantity) * mult(r))),
      unitCost: String(round6(Number(r.unitCost) / mult(r))),
      expiresAt: r.expiresAt,
    }));
    const fd = new FormData(e.currentTarget);
    fd.set("items", JSON.stringify(items));
    start(() => formAction(fd));
  }

  const err = localError ?? state?.error;
  const lab = (idx: number, text: string) => <span className={`mb-1 block text-xs text-neutral-500 ${idx > 0 ? "md:hidden" : ""}`}>{text}</span>;

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <div className="max-w-sm"><LocationField options={locations} defaultValue={defaultLocationId} /></div>

      <details className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold">Вставить списком из накладной или Excel</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-neutral-500">
            Одна позиция в строке: <b>название; количество; цена; срок годности</b>. Разделитель — «;» или табуляция (копирование из Excel). Цена и срок необязательны. Цена указывается за ту же единицу, что и количество. Пример:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-white p-2 text-xs text-neutral-700">{"Клубника; 5 кг; 60000\nМолоко; 10 л; 12000; 15.11.2026\nСтакан 400 мл; 500 шт"}</pre>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder="Вставьте строки сюда" className={`${fieldClass} font-mono`} aria-label="Список прихода" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => addPasted()} disabled={!paste.trim()} className="rounded-xl border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-40">Добавить в таблицу</button>
            {pasteInfo && pasteInfo.added > 0 && <span className="text-sm text-green-800">Добавлено позиций: {pasteInfo.added}</span>}
          </div>
          {pasteInfo && pasteInfo.errors.length > 0 && (
            <div className="space-y-2">
            {pasteInfo.missing.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
                <span>Нет на складе: <b>{pasteInfo.missing.map((m) => m.name).join(", ")}</b>. Единица определена по записи количества.</span>
                <input list="receive-categories" value={lastCategory} onChange={(e) => setLastCategory(e.target.value)} aria-label="Категория для новых продуктов" className="w-40 rounded-lg border border-neutral-200 bg-white px-2 py-1" />
                <button type="button" onClick={createMissing} disabled={creatingMissing || lastCategory.trim().length < 2} className="rounded-xl bg-green-700 px-4 py-1.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{creatingMissing ? "Создаём…" : `Создать (${pasteInfo.missing.length}) и добавить`}</button>
              </div>
            )}
            <ul className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {pasteInfo.errors.map((x) => <li key={x}>{x}</li>)}
              <li className="text-xs">Эти строки остались в поле. Поправьте их и нажмите «Добавить в таблицу» ещё раз.</li>
            </ul>
            </div>
          )}
        </div>
      </details>

      <div className="space-y-3">
        <datalist id="receive-categories">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="receive-ingredients">{ingredients.map((i) => <option key={i.id} value={labelOf(i)} />)}</datalist>
        <p className="text-xs text-neutral-500">Начните вводить название и выберите из списка. Enter переводит на следующую строку. Для г и мл можно переключить на кг и л. Цена подставляется прежняя, поправьте её, если изменилась.</p>
        {rows.map((r, idx) => {
          const ing = byId.get(r.ingredientId);
          const b = ing ? bigUnit(ing.unit) : null;
          const base = ing ? BASE_LABEL[ing.unit] : "";
          const shown = r.big && b ? b.label : base;
          const lineTotal = (Number(r.quantity) || 0) * (Number(r.unitCost) || 0);
          const unknown = r.label.trim() !== "" && !r.ingredientId;
          return (
            <div key={idx} className="space-y-2">
            <div className="grid items-end gap-2 rounded-xl border border-neutral-100 p-3 md:grid-cols-[1fr_190px_160px_150px_100px_36px] md:border-0 md:p-0">
              <label className="block">{lab(idx, "Ингредиент")}
                <input data-row={idx} data-col="ing" list="receive-ingredients" value={r.label} onChange={(e) => onIngredient(idx, e.target.value)} onBlur={() => onIngredientBlur(idx)} onKeyDown={(e) => onEnter(e, idx)} autoComplete="off" placeholder="Начните вводить…"
                  className={`${fieldClass} ${unknown ? "border-red-400" : ""}`} aria-invalid={unknown} />
              </label>
              <div>{lab(idx, `Количество${shown ? `, ${shown}` : ""}`)}
                <div className="flex gap-1">
                  <input type="number" min="0" step="any" inputMode="decimal" value={r.quantity} onChange={(e) => set(idx, { quantity: e.target.value })} onKeyDown={(e) => onEnter(e, idx)} aria-label={`Количество, строка ${idx + 1}`} className={fieldClass} />
                  {b && (
                    <select value={r.big ? "big" : "base"} onChange={(e) => toggle(idx, e.target.value === "big")} aria-label={`Единица, строка ${idx + 1}`} className="rounded-lg border border-neutral-200 bg-white px-1 text-sm">
                      <option value="base">{base}</option><option value="big">{b.label}</option>
                    </select>
                  )}
                </div>
              </div>
              <label className="block">{lab(idx, `Цена за 1 ${shown || "ед."}, UZS`)}
                <input type="number" min="0" step="any" inputMode="decimal" value={r.unitCost} onChange={(e) => set(idx, { unitCost: e.target.value })} onKeyDown={(e) => onEnter(e, idx)} aria-label={`Цена, строка ${idx + 1}`} className={fieldClass} />
              </label>
              <label className="block">{lab(idx, "Срок годности")}
                <input type="date" value={r.expiresAt} onChange={(e) => set(idx, { expiresAt: e.target.value })} onKeyDown={(e) => onEnter(e, idx)} aria-label={`Срок годности, строка ${idx + 1}`} className={fieldClass} />
              </label>
              <p className="py-2 text-right text-sm text-neutral-600">{lineTotal ? fmt(lineTotal) : ""}</p>
              <button type="button" disabled={rows.length === 1} onClick={() => setRows((x) => (x.length === 1 ? x : x.filter((_, i) => i !== idx)))} className="rounded-lg border border-neutral-200 py-2 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30" aria-label={`Удалить строку ${idx + 1}`}>×</button>
            </div>
            {unknown && quick?.idx !== idx && (
              <p className="text-sm text-neutral-600">
                Такого продукта нет на складе.{" "}
                <button type="button" onClick={() => openQuick(idx)} className="font-semibold text-green-800 underline">+ Создать «{r.label.trim()}»</button> и продолжить приход.
              </p>
            )}
            {quick?.idx === idx && (
              <div className="grid items-end gap-3 rounded-xl border border-green-200 bg-green-50 p-3 md:grid-cols-[1fr_1fr_auto]" role="group" aria-label="Новый продукт">
                <label className="block"><span className="mb-1 block text-xs text-neutral-600">Категория</span>
                  <input list="receive-categories" value={quick.category} onChange={(e) => setQuick({ ...quick, category: e.target.value })} aria-label="Категория нового продукта" className={fieldClass} />
                </label>
                <label className="block"><span className="mb-1 block text-xs text-neutral-600">Как считаем на складе</span>
                  <select value={quick.unit} onChange={(e) => setQuick({ ...quick, unit: e.target.value })} aria-label="Единица нового продукта" className={fieldClass}>
                    {UNIT_CHOICES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={createQuick} disabled={quick.busy || quick.category.trim().length < 2} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">{quick.busy ? "Создаём…" : "Создать и продолжить"}</button>
                  <button type="button" onClick={() => setQuick(null)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm">Отмена</button>
                </div>
                <p className="text-xs text-neutral-600 md:col-span-3">Будет создан «{r.label.trim().replace(/\s*\((г|мл|шт|кг|л)\)\s*$/i, "")}». Минимум остатка, срок годности и поставщика можно задать позже в карточке продукта. Цену укажите в этой строке.</p>
                {quick.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-3" role="alert">{quick.error}</p>}
              </div>
            )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={addRow} disabled={rows.length >= MAX_ROWS} className="text-sm text-green-800 underline disabled:opacity-40">+ Добавить строку</button>
          <button type="button" onClick={() => setRows((r) => [...r, ...Array.from({ length: 5 }, empty)].slice(0, MAX_ROWS))} disabled={rows.length >= MAX_ROWS} className="text-sm text-green-800 underline disabled:opacity-40">+ 5 строк</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
        <p className="text-sm text-neutral-600">Позиций: <b>{filled.length}</b></p>
        <p className="text-lg font-bold">Итого: {fmt(total)} UZS</p>
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Оформляем…" : `Оформить приход${filled.length ? ` (${filled.length})` : ""}`}</button>
        <Link href="/admin/inventory" className="rounded-xl border border-neutral-200 px-6 py-2.5">Отмена</Link>
      </div>
      <p className="text-xs text-neutral-500">Всё оформляется одной операцией: если в какой-то строке ошибка, на склад не попадёт ничего, и можно спокойно поправить и отправить снова. Для каждой строки создаётся своя партия, средняя цена ингредиента пересчитывается.</p>
    </form>
  );
}
