"use client";
import { useState } from "react";
import { Field, fieldClass } from "@/components/admin/ops";
import { recvUnit, round6 } from "@/components/admin/units";

type Ing = { id: string; name: string; unit: string };

/** Ингредиент + количество (+ цена) в кг, л или шт. На сервер уходят значения в учётной единице (г, мл, шт). */
export function IngredientQty({ ingredients, withCost }: { ingredients: Ing[]; withCost?: boolean }) {
  const [id, setId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const ing = ingredients.find((i) => i.id === id);
  const u = ing ? recvUnit(ing.unit) : null;
  const mult = u?.mult ?? 1;
  const baseQty = qty === "" ? "" : String(round6(Number(qty) * mult));
  const baseCost = cost === "" ? "" : String(round6(Number(cost) / mult));

  return (
    <div className="space-y-4">
      <Field label="Ингредиент">
        <select required value={id} onChange={(e) => { setId(e.target.value); setQty(""); setCost(""); }} className={fieldClass}>
          <option value="" disabled>Выберите…</option>
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({recvUnit(i.unit).label})</option>)}
        </select>
      </Field>
      <input type="hidden" name="ingredientId" value={id} />
      <input type="hidden" name="quantity" value={baseQty} />
      {withCost && <input type="hidden" name="unitCost" value={baseCost} />}
      <div className={`grid gap-4 ${withCost ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <Field label={`Количество${u ? `, ${u.label}` : ""}`}>
          <div className="relative">
            <input type="number" min="0" step="any" inputMode="decimal" required value={qty} onChange={(e) => setQty(e.target.value)} className={`${fieldClass} ${u ? "pr-10" : ""}`} />
            {u && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-neutral-500">{u.label}</span>}
          </div>
        </Field>
        {withCost && (
          <Field label={`Цена за 1 ${u?.label ?? "ед."}, UZS`}>
            <input type="number" min="0" step="any" inputMode="decimal" required value={cost} onChange={(e) => setCost(e.target.value)} className={fieldClass} />
          </Field>
        )}
      </div>
    </div>
  );
}
