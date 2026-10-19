"use client";
import { useState } from "react";
import { fieldClass } from "@/components/admin/ops";
import { recvUnit, round6 } from "@/components/admin/units";

/** Фактический остаток при инвентаризации: вводим кг, л или шт, на сервер уходит учётная единица (г, мл, шт) */
export function CountInput({ ingredientId, unit }: { ingredientId: string; unit: string }) {
  const u = recvUnit(unit);
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input type="number" min="0" step="any" inputMode="decimal" placeholder="—" value={v} onChange={(e) => setV(e.target.value)} aria-label={`Факт, ${u.label}`} className={`${fieldClass} w-32`} />
      <span className="text-neutral-500">{u.label}</span>
      <input type="hidden" name={`actual_${ingredientId}`} value={v === "" ? "" : String(round6(Number(v) * u.mult))} />
    </div>
  );
}
