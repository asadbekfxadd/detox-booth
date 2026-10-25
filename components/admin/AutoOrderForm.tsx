"use client";
import { useActionState, useState } from "react";
import type { OpState } from "@/components/admin/ops";
import { money } from "@/lib/format";
import { bigUnit, fmtStock } from "@/lib/ingredient-units";

export type AutoLine = {
  ingredientId: string; name: string; unit: string; supplierId: string | null; supplier: string | null;
  stock: number; onOrder: number; min: number; daysLeft: number | null; qty: number; unitCost: number; reason: "below_min" | "runs_out";
};
const input = "w-24 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-green-600";
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Предложенный заказ по поставщикам: галочка и количество у каждой позиции, итог по поставщику. Создаются только черновики. */
export function AutoOrderForm({ action, locationId, lines }: { action: (prev: OpState, fd: FormData) => Promise<OpState>; locationId: string; lines: AutoLine[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(lines.map((l) => [l.ingredientId, !!l.supplierId])));
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.ingredientId, String(r3(l.qty / bigUnit(l.unit).factor))])));
  const base = (l: AutoLine) => r3((Number(qty[l.ingredientId]) || 0) * bigUnit(l.unit).factor);
  const chosen = lines.filter((l) => on[l.ingredientId] && l.supplierId && base(l) > 0);
  const groups = new Map<string, AutoLine[]>();
  for (const l of lines) { const k = l.supplier ?? "Без поставщика"; groups.set(k, [...(groups.get(k) ?? []), l]); }
  const payload = { locationId, lines: chosen.map((l) => ({ ingredientId: l.ingredientId, quantity: base(l) })) };
  const suppliersCount = new Set(chosen.map((l) => l.supplierId)).size;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {[...groups].map(([supplier, ls]) => {
        const sum = ls.filter((l) => chosen.includes(l)).reduce((a, l) => a + base(l) * l.unitCost, 0);
        return (
          <div key={supplier} className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 p-3">
              <p className="font-semibold">{supplier}</p>
              {ls[0].supplierId ? <p className="text-sm text-neutral-600">На сумму: <b>{money(sum)}</b></p> : <p className="text-sm text-amber-800">Укажите поставщика в карточке продукта, иначе заказать нельзя</p>}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-neutral-500"><th className="p-3 w-8" /><th>Продукт</th><th className="text-right">Остаток</th><th className="text-right">Минимум</th><th className="text-right">Хватит на</th><th className="text-right">Заказать</th><th className="p-3 text-right">Сумма</th></tr></thead>
              <tbody>
                {ls.map((l) => (
                  <tr key={l.ingredientId} className="border-t border-neutral-100">
                    <td className="p-3"><input type="checkbox" checked={!!on[l.ingredientId]} disabled={!l.supplierId} onChange={(e) => setOn({ ...on, [l.ingredientId]: e.target.checked })} aria-label={`Заказать ${l.name}`} /></td>
                    <td className="font-medium">{l.name}{l.onOrder > 0 && <span className="ml-2 text-xs font-normal text-neutral-500">уже заказано {fmtStock(l.unit, l.onOrder)}</span>}</td>
                    <td className={`text-right ${l.reason === "below_min" ? "text-red-700" : ""}`}>{fmtStock(l.unit, l.stock)}</td>
                    <td className="text-right text-neutral-600">{fmtStock(l.unit, l.min)}</td>
                    <td className="text-right text-neutral-600">{l.daysLeft == null ? "нет продаж" : l.daysLeft < 1 ? "меньше дня" : l.daysLeft > 60 ? "больше 60 дн." : `${Math.floor(l.daysLeft)} дн.`}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input type="number" min="0" step="any" value={qty[l.ingredientId]} onChange={(e) => setQty({ ...qty, [l.ingredientId]: e.target.value })} className={input} aria-label={`${l.name}: сколько заказать`} />
                        <span className="text-xs text-neutral-500">{bigUnit(l.unit).label}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right text-neutral-600">{money(base(l) * l.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || chosen.length === 0} className="rounded-xl bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {pending ? "Создаём…" : chosen.length ? `Создать черновики (${suppliersCount} поставщ., ${chosen.length} поз.)` : "Отметьте позиции"}
        </button>
        <span className="text-xs text-neutral-500">Заказ у поставщика не оформляется: вы откроете каждый черновик, проверите и нажмёте «Оформить заказ».</span>
      </div>
    </form>
  );
}
