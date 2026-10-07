"use client";
import { useState } from "react";
import { Field, fieldClass } from "@/components/admin/ops";
import { BASE_LABEL, bigUnit, round6 } from "@/components/admin/units";

type Ing = { id: string; name: string; unit: string };
const nf = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 4 }).format(n);

/** Ингредиент + количество (+ цена). Всегда отправляет на сервер значения в базовой единице (г, мл, шт). */
export function IngredientQty({ ingredients, withCost }: { ingredients: Ing[]; withCost?: boolean }) {
  const [id, setId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [big, setBig] = useState(false);
  const ing = ingredients.find((i) => i.id === id);
  const bu = ing ? bigUnit(ing.unit) : null;
  const mult = big && bu ? bu.mult : 1;
  const base = ing ? BASE_LABEL[ing.unit] : "";
  const shown = big && bu ? bu.label : base;
  const baseQty = qty === "" ? "" : String(round6(Number(qty) * mult));
  const baseCost = cost === "" ? "" : String(round6(Number(cost) / mult));

  function toggle(next: boolean) {
    if (!bu) return;
    const k = next ? 1 / bu.mult : bu.mult;
    if (qty !== "") setQty(String(round6(Number(qty) * k)));
    if (cost !== "") setCost(String(round6(Number(cost) / k)));
    setBig(next);
  }

  return (
    <div className="space-y-4">
      <Field label="Ингредиент">
        <select required value={id} onChange={(e) => { setId(e.target.value); setBig(false); setQty(""); setCost(""); }} className={fieldClass}>
          <option value="" disabled>Выберите…</option>
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({BASE_LABEL[i.unit]})</option>)}
        </select>
      </Field>
      <input type="hidden" name="ingredientId" value={id} />
      <input type="hidden" name="quantity" value={baseQty} />
      {withCost && <input type="hidden" name="unitCost" value={baseCost} />}
      <div className={`grid gap-4 ${withCost ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <Field label={`Количество${ing ? `, ${shown}` : ""}`}>
          <div className="flex gap-2">
            <input type="number" min="0" step="any" required value={qty} onChange={(e) => setQty(e.target.value)} className={fieldClass} />
            {bu && (
              <select value={big ? "big" : "base"} onChange={(e) => toggle(e.target.value === "big")} className="rounded-lg border border-neutral-200 bg-white px-2 text-sm">
                <option value="base">{base}</option><option value="big">{bu.label}</option>
              </select>
            )}
          </div>
        </Field>
        {withCost && (
          <Field label={`Цена за 1 ${shown || "ед."}, UZS`}>
            <input type="number" min="0" step="any" required value={cost} onChange={(e) => setCost(e.target.value)} className={fieldClass} />
          </Field>
        )}
      </div>
      {ing && qty !== "" && (
        <p className="text-xs text-neutral-500">
          Будет записано: <b>{nf(Number(baseQty))} {base}</b>
          {withCost && cost !== "" && <> по <b>{nf(Number(baseCost))} UZS за 1 {base}</b>{bu ? ` (${nf(Number(baseCost) * bu.mult)} UZS за 1 ${bu.label})` : ""}</>}
        </p>
      )}
    </div>
  );
}
