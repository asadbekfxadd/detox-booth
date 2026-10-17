import { Field, fieldClass } from "@/components/admin/ops";

/** Поля формы оборудования. Амортизация одного напитка = цена ÷ ресурс в напитках. */
export function EquipmentFields({ categories, v }: {
  categories: { id: string; name: string }[];
  v?: { name?: string; price?: number; lifeDrinks?: number; categoryId?: string | null };
}) {
  return (
    <>
      <Field label="Название"><input name="name" required maxLength={80} defaultValue={v?.name} placeholder="Например: Шнековая соковыжималка" className={fieldClass} /></Field>
      <Field label="Цена покупки, UZS"><input name="price" type="number" required min={1} step="any" inputMode="numeric" defaultValue={v?.price} className={fieldClass} /></Field>
      <Field label="Ресурс в напитках">
        <input name="lifeDrinks" type="number" required min={1} step="1" inputMode="numeric" defaultValue={v?.lifeDrinks} placeholder="Например 30000" className={fieldClass} />
        <span className="mt-1 block text-xs text-neutral-500">Сколько напитков оборудование отработает до замены. Например, выжималка за 6 000 000 с ресурсом 30 000 напитков добавляет 200 UZS к каждому напитку.</span>
      </Field>
      <Field label="Для каких напитков">
        <select name="categoryId" defaultValue={v?.categoryId ?? ""} className={fieldClass}>
          <option value="">Для всех напитков (холодильник, касса)</option>
          {categories.map((c) => <option key={c.id} value={c.id}>Только категория «{c.name}»</option>)}
        </select>
        <span className="mt-1 block text-xs text-neutral-500">Выжималка относится к сокам, блендер — к смузи. Амортизация ляжет только на эти напитки.</span>
      </Field>
    </>
  );
}
