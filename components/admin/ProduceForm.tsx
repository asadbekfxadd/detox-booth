"use client";
import { useActionState, useState } from "react";
import type { OpState } from "@/components/admin/ops";
import { money } from "@/lib/format";
import { fmtQty, smallLabel } from "@/lib/ingredient-units";
import { scalePrepItems } from "@/lib/prep";

const input = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600";

/** Акт приготовления: сколько готовим, что спишется со склада, чего не хватает. */
export function ProduceForm({ action, prep, locations, defaultLocationId, showCost }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>;
  prep: { id: string; name: string; unit: string; outputQty: number; items: { ingredientId: string; name: string; unit: string; quantity: number; avgCost: number; stock: number }[] };
  locations: { id: string; name: string }[]; defaultLocationId: string; showCost: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [want, setWant] = useState(String(prep.outputQty));
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const w = Number(want) || 0;
  const scaled = scalePrepItems(prep.items, prep.outputQty, w);
  const lines = prep.items.map((i, idx) => ({ ...i, need: scaled[idx].quantity }));
  const short = lines.filter((l) => l.need > l.stock);
  const cost = lines.reduce((a, l) => a + l.need * l.avgCost, 0);
  const got = Number(actual) || w;

  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <input type="hidden" name="ingredientId" value={prep.id} />
      <h2 className="text-lg font-semibold">Приготовить</h2>
      <div className="grid gap-3 md:grid-cols-4">
        {locations.length > 1
          ? <label className="block text-sm"><span className="mb-1 block text-neutral-600">Точка</span>
              <select name="locationId" defaultValue={defaultLocationId} className={`${input} w-full`}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          : <><input type="hidden" name="locationId" value={locations[0]?.id ?? ""} /><div className="text-sm"><span className="mb-1 block text-neutral-600">Точка</span><p className="py-2 font-medium">{locations[0]?.name}</p></div></>}
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Готовим, {smallLabel(prep.unit)}</span>
          <input name="quantity" type="number" min="0" step="any" value={want} onChange={(e) => setWant(e.target.value)} className={`${input} w-full`} aria-label="Сколько готовим" /></label>
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Получилось, {smallLabel(prep.unit)} (если иначе)</span>
          <input name="actualQty" type="number" min="0" step="any" value={actual} onChange={(e) => setActual(e.target.value)} placeholder={want} className={`${input} w-full`} aria-label="Сколько получилось" /></label>
        <label className="block text-sm"><span className="mb-1 block text-neutral-600">Комментарий</span>
          <input name="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={`${input} w-full`} /></label>
      </div>
      <p className="text-xs text-neutral-500">Сырьё спишется по тому, сколько собираетесь приготовить. Если получилось меньше или больше, впишите фактическое: заготовка встанет на склад в этом количестве, а себестоимость единицы пересчитается.</p>

      {w > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="py-1">Спишется</th><th className="text-right">Сколько</th><th className="text-right">На складе</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.ingredientId} className="border-t border-neutral-100">
                  <td className="py-1.5">{l.name}</td>
                  <td className="text-right">{fmtQty(l.unit, l.need)}</td>
                  <td className={`text-right ${l.need > l.stock ? "font-semibold text-red-700" : "text-neutral-600"}`}>{fmtQty(l.unit, l.stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {showCost && cost > 0 && <p className="mt-2 text-sm">Сырьё примерно на <b>{money(cost)}</b>, 1 {smallLabel(prep.unit)} заготовки ≈ <b>{money(got > 0 ? cost / got : 0)}</b></p>}
        </div>
      )}
      {short.length > 0 && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Не хватает: <b>{short.map((s) => s.name).join(", ")}</b>. Сначала оформите приход.</p>}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending || w <= 0 || short.length > 0} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">{pending ? "Оформляем…" : "Оформить акт приготовления"}</button>
    </form>
  );
}
