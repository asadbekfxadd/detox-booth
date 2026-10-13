import { Field, LocationField, fieldClass } from "@/components/admin/ops";

type Z = { locationId?: string; name?: string; fee?: number; minOrder?: number; freeFrom?: number | null; sort?: number; isActive?: boolean };

/** Поля формы зоны доставки (создание и правка). */
export function ZoneFields({ z, locations, lockLocation }: { z?: Z; locations: { id: string; name: string }[]; lockLocation?: boolean }) {
  return (
    <>
      {lockLocation && z?.locationId
        ? <input type="hidden" name="locationId" value={z.locationId} />
        : <LocationField options={locations} defaultValue={z?.locationId} />}
      <Field label="Название зоны (например, Центр или За рекой)"><input name="name" required maxLength={60} defaultValue={z?.name} className={fieldClass} /></Field>
      <Field label="Цена доставки, сум (0 — бесплатно)"><input name="fee" type="number" min="0" step="1000" defaultValue={z?.fee ?? 0} className={fieldClass} /></Field>
      <Field label="Минимальный заказ, сум (0 — без минимума)"><input name="minOrder" type="number" min="0" step="1000" defaultValue={z?.minOrder ?? 0} className={fieldClass} /></Field>
      <Field label="Бесплатная доставка от суммы заказа, сум (пусто — всегда платная)"><input name="freeFrom" type="number" min="0" step="1000" defaultValue={z?.freeFrom ?? ""} className={fieldClass} /></Field>
      <Field label="Порядок в списке (меньше — выше)"><input name="sort" type="number" min="0" step="1" defaultValue={z?.sort ?? 0} className={fieldClass} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={z?.isActive ?? true} className="size-4" />Зона принимает заказы</label>
    </>
  );
}
