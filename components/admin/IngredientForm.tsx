"use client";
import { useState } from "react";
import { FormShell, Field, fieldClass, type OpState } from "@/components/admin/ops";
import { UNIT_CHOICES, bigUnit } from "@/lib/ingredient-units";

export type IngredientDefaults = {
  id?: string; name: string; category: string; unit: string; price: number; minStock: number;
  shelfLifeDays: number | null; supplierId: string | null; locked: boolean;
};

const EMPTY: IngredientDefaults = { name: "", category: "", unit: "G", price: 0, minStock: 0, shelfLifeDays: null, supplierId: null, locked: false };

export function IngredientForm({ action, submitLabel, defaults = EMPTY, categories, suppliers }: {
  action: (prev: OpState, fd: FormData) => Promise<OpState>; submitLabel: string; defaults?: IngredientDefaults;
  categories: string[]; suppliers: { id: string; name: string }[];
}) {
  const [unit, setUnit] = useState(defaults.unit);
  const big = bigUnit(unit).label;
  const choice = UNIT_CHOICES.find((u) => u.value === unit);
  const legacy = !UNIT_CHOICES.some((u) => u.value === defaults.unit); // старые ингредиенты в кг/л

  return (
    <FormShell action={action} submitLabel={submitLabel} cancelHref="/admin/ingredients">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Название"><input name="name" defaultValue={defaults.name} required placeholder="Клубника" className={fieldClass} /></Field>
        <Field label="Категория">
          <input name="category" list="ing-cats" defaultValue={defaults.category} required placeholder="Ягоды" className={fieldClass} />
          <datalist id="ing-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>

      <div className="space-y-2">
        <Field label="Как считаем на складе">
          {defaults.locked || legacy ? (
            <>
              <input type="hidden" name="unit" value={defaults.unit} />
              <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm font-medium">{legacy ? bigUnit(defaults.unit).label : choice?.label}</p>
            </>
          ) : (
            <select name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={fieldClass}>
              {UNIT_CHOICES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          )}
        </Field>
        <p className="text-xs text-neutral-500">
          {defaults.locked ? "Единицу нельзя менять: по ингредиенту уже есть рецепты, приходы или списания." : choice?.hint}
          {" "}В рецепте количество на порцию пишется в {unit === "G" ? "граммах" : unit === "ML" ? "миллилитрах" : "штуках"}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label={`Цена за 1 ${big}, UZS`}>
          <input name="price" type="number" min="0" step="any" defaultValue={defaults.price || ""} placeholder="60000" className={fieldClass} />
        </Field>
        <Field label={`Минимальный остаток, ${big}`}>
          <input name="minStock" type="number" min="0" step="any" defaultValue={defaults.minStock || ""} placeholder="2" className={fieldClass} />
        </Field>
        <Field label="Срок годности, дней">
          <input name="shelfLifeDays" type="number" min="1" step="1" defaultValue={defaults.shelfLifeDays ?? ""} placeholder="5" className={fieldClass} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-neutral-500">Цена нужна для себестоимости; при каждом приходе она пересчитывается по средней. Ниже минимального остатка склад подсветит «LOW STOCK».</p>

      <Field label="Поставщик (необязательно)">
        <select name="supplierId" defaultValue={defaults.supplierId ?? ""} className={fieldClass}>
          <option value="">—</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
    </FormShell>
  );
}
