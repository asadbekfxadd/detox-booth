"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { previewDraftAction, createDraftAction } from "@/app/admin/products/quick/actions";
import type { Preview } from "@/services/product-draft";
import { smallLabel } from "@/lib/ingredient-units";

const base = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";
const input = `w-full ${base}`;
const EXAMPLES = [
  "Яблочный фреш: яблоко 300 г, морковь 150 г, лимон 20 г. Размеры 300 и 500 мл, цена 25000 и 38000",
  "Зелёный смузи\nшпинат 40 г\nбанан 1 шт\nяблоко 100 г\nмолоко 100 мл\n350 мл — 32000",
  "Имбирный шот: имбирь 30 г, лимон 20 г, мёд 10 г, 60 мл, цена 15000",
];

type Size = Preview["sizes"][number];

export function QuickProduct() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [sizes, setSizes] = useState<Size[]>([]);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  function analyze() {
    setError("");
    start(async () => {
      const r = await previewDraftAction(text);
      if ("error" in r) { setError(r.error); return; }
      const p = r.preview;
      setPreview(p); setName(p.name); setCategoryId(p.categoryId ?? ""); setDescription(p.description); setSizes(p.sizes);
    });
  }
  function create() {
    setError("");
    start(async () => {
      const r = await createDraftAction(JSON.stringify({
        name, categoryId, description,
        sizes: sizes.map((s) => ({ name: s.name, price: s.price ?? 0, items: s.items })),
      }));
      if (r?.error) setError(r.error);
    });
  }
  const setSize = (i: number, patch: Partial<Size>) => setSizes((ss) => ss.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const ready = !!preview && name.trim().length >= 2 && !!categoryId && sizes.length > 0 && sizes.every((s) => s.name.trim() && (s.price ?? 0) > 0);

  if (!preview) {
    return (
      <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="space-y-1 text-sm text-neutral-600">
          <p>Опишите продукт своими словами: <b>название, из чего он и сколько граммов, размеры и цену</b>. Я разберу текст, подберу ингредиенты со склада, категорию и напишу описание. Перед созданием вы всё проверите.</p>
          <p>Граммы пишите на <b>первый (самый маленький) размер</b>, на остальные я пересчитаю пропорционально объёму. Потом всё можно поправить в рецепте.</p>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-label="Описание продукта" placeholder={EXAMPLES[0]} className={`${input} text-base`} />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-500">Примеры:</span>
          {EXAMPLES.map((ex, i) => <button key={i} type="button" onClick={() => setText(ex)} className="rounded-full border border-green-700/30 px-3 py-1 text-green-800 hover:bg-green-50">{ex.split(/[:\n]/)[0]}</button>)}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={analyze} disabled={busy || text.trim().length < 3} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{busy ? "Разбираю…" : "Разобрать описание"}</button>
          <Link href="/admin/products" className="rounded-xl border border-neutral-200 px-6 py-2.5">Отмена</Link>
        </div>
      </div>
    );
  }

  // ингредиенты берём из первого размера: их набор одинаков, меняются только граммы
  const rowsOf = sizes[0]?.items ?? [];
  return (
    <div className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <p className="rounded-xl bg-lime-100 px-4 py-3 text-sm text-green-900">Вот что получилось. Проверьте и поправьте при необходимости, после кнопки продукт появится в меню.</p>
      {preview.warnings.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Название *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} aria-label="Название" /></label>
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Категория *</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input} aria-label="Категория">
            <option value="" disabled>Выберите…</option>
            {preview.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="block text-sm md:col-span-2"><span className="mb-1 block text-neutral-600">Описание для карточки</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} className={input} aria-label="Описание" /></label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-1 align-bottom">Состав</th>
              {sizes.map((s, i) => (
                <th key={i} className="pr-2 align-bottom">
                  <div className="space-y-1">
                    <input value={s.name} onChange={(e) => setSize(i, { name: e.target.value })} aria-label="Название размера" className={`${base} w-28 font-semibold text-neutral-800`} />
                    <div className="flex items-center gap-1 font-normal"><input type="number" min="0" step="any" value={s.price ?? ""} onChange={(e) => setSize(i, { price: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Цена" aria-label={`Цена ${s.name}`} className={`${base} w-28 text-neutral-800`} /><span className="text-xs">UZS</span></div>
                  </div>
                </th>
              ))}
              <th className="align-bottom">Склад</th>
            </tr>
          </thead>
          <tbody>
            {rowsOf.map((it, r) => (
              <tr key={r} className="border-t border-neutral-100">
                <td className="py-2 font-medium">{it.name}</td>
                {sizes.map((s, i) => <td key={i} className="pr-2 text-neutral-700">{s.items[r]?.quantity} {smallLabel(it.unit)}</td>)}
                <td>{it.ingredientId ? <span className="rounded bg-lime-100 px-2 py-0.5 text-xs text-green-900">есть на складе</span> : <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">новый, создам</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.newIngredients.length > 0 && <p className="text-xs text-neutral-500">Новые ингредиенты ({preview.newIngredients.join(", ")}) создадутся без цены: впишите цену за кг/л/шт в рецепте, и себестоимость посчитается.</p>}
      {sizes.some((s) => !(s.price && s.price > 0)) && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Впишите цену для каждого размера.</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={create} disabled={busy || !ready} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{busy ? "Создаю…" : "Создать и добавить в меню"}</button>
        <button type="button" onClick={() => { setPreview(null); setError(""); }} className="rounded-xl border border-neutral-200 px-6 py-2.5">Изменить текст</button>
      </div>
    </div>
  );
}
