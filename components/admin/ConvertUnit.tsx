"use client";
import { useState } from "react";
import { FormShell, Field, fieldClass, type OpState } from "@/components/admin/ops";
import { conversionFactor, fmtStock, smallLabel, UNIT_CHOICES } from "@/lib/ingredient-units";

const famOf = (u: string) => (u === "PC" ? "pc" : u === "G" || u === "KG" ? "mass" : "vol");

/** Перевод ингредиента в другую единицу (шт → кг и т. д.): остатки, рецепты, партии и история пересчитываются. */
export function ConvertUnit({ action, id, unit, total, pieceWeightG }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>; id: string; unit: string; total: number; pieceWeightG: number | null;
}) {
  const options = UNIT_CHOICES.filter((u) => u.value !== unit);
  const [to, setTo] = useState<string>(options[0]?.value ?? "G");
  const [perPiece, setPerPiece] = useState(pieceWeightG ? String(pieceWeightG) : "");
  const [density, setDensity] = useState("1");
  const needPiece = (famOf(unit) === "pc") !== (famOf(to) === "pc");
  const needDensity = !needPiece && famOf(unit) !== famOf(to);
  const pieceSide = famOf(unit) === "pc" ? to : unit; // чем меряем вес штуки: г или мл
  let preview: string | null = null;
  try {
    const f = conversionFactor(unit, to, { perPiece: Number(perPiece) || undefined, density: Number(density) || undefined });
    preview = `${fmtStock(unit, total)} → ${fmtStock(to, total * f)}`;
  } catch { preview = null; }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">Перевести в другую единицу</p>
        <p className="text-sm text-neutral-600">Например, из штук в килограммы. Остаток на складе, партии, рецепты, приходы и списания пересчитаются сами; деньги и суммы не изменятся.</p>
      </div>
      <FormShell action={action} submitLabel="Перевести" cancelHref={`/admin/ingredients/${id}`}>
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Новая единица">
            <select name="unit" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass}>
              {options.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
          {needPiece && (
            <Field label={`Сколько ${smallLabel(pieceSide === "ML" ? "ML" : "G")} в одной штуке`}>
              <input name="perPiece" type="number" min="0" step="any" required value={perPiece} onChange={(e) => setPerPiece(e.target.value)} placeholder="150" className={fieldClass} />
            </Field>
          )}
          {needDensity && (
            <Field label={`Сколько мл в 1 г (вода и соки = 1)`}>
              <input name="density" type="number" min="0" step="any" value={density} onChange={(e) => setDensity(e.target.value)} className={fieldClass} />
            </Field>
          )}
        </div>
        {preview ? <p className="rounded-lg bg-[#f7f3ea] px-3 py-2 text-sm">Остаток сейчас: <b>{preview}</b>. Рецепты и цены пересчитаются так же.</p>
          : needPiece && <p className="text-sm text-neutral-500">Впишите вес одной штуки, чтобы увидеть результат.</p>}
        <p className="text-xs text-neutral-500">Действие нельзя отменить кнопкой, но можно перевести обратно с тем же числом: учёт останется верным (возможно небольшое округление до 3 знаков).</p>
      </FormShell>
    </div>
  );
}
