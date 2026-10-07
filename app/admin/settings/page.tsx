import { pageGuard } from "@/lib/guard";
import { SETTING_FIELDS, getSettingValues } from "@/services/settings";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { listLocationContacts } from "@/services/locations";
import { hasExactAddress } from "@/lib/brand";
import { saveSettingsAction, saveLocationsAction } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; loc?: string }> }) {
  await pageGuard("settings.edit");
  const { ok, loc } = await searchParams;
  const [values, locations] = await Promise.all([getSettingValues(), listLocationContacts()]);
  const groups = [...new Set(SETTING_FIELDS.map((f) => f.group))];
  return (
    <div className="max-w-2xl space-y-5">
      <div><h1 className="text-2xl font-bold">Настройки</h1><p className="text-sm text-neutral-500">Изменения применяются сразу и записываются в журнал действий.</p></div>
      {ok != null && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{ok === "0" ? "Изменений нет" : `Настройки сохранены (изменено: ${ok})`}</p>}
      <FormShell action={saveSettingsAction} submitLabel="Сохранить" cancelHref="/admin/settings">
        {groups.map((g) => (
          <fieldset key={g} className="space-y-4">
            <legend className="mb-1 text-sm font-bold uppercase tracking-wide text-green-800">{g}</legend>
            {SETTING_FIELDS.filter((f) => f.group === g).map((f) => (
              <Field key={f.key} label={f.label}>
                <input name={f.key} type="number" required min={f.min} max={f.max} step={f.step} defaultValue={values[f.key]} className={fieldClass} />
                <span className="mt-1 block text-xs text-neutral-500">{f.hint}</span>
              </Field>
            ))}
          </fieldset>
        ))}
      </FormShell>

      <div className="border-t border-neutral-200 pt-5">
        <h2 className="text-lg font-bold">Точки на сайте</h2>
        <p className="text-sm text-neutral-500">Адрес и телефон показываются клиентам. По точному адресу (улица и дом) внизу сайта появляется карта.</p>
      </div>
      {loc != null && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{loc === "0" ? "Изменений нет" : `Точки сохранены (изменено: ${loc})`}</p>}
      <FormShell action={saveLocationsAction} submitLabel="Сохранить точки" cancelHref="/admin/settings">
        {locations.map((l) => (
          <fieldset key={l.id} className="space-y-3">
            <input type="hidden" name="id" value={l.id} />
            <legend className="mb-1 text-sm font-bold text-green-800">{l.name}</legend>
            <Field label="Адрес">
              <input name={`address:${l.id}`} maxLength={200} defaultValue={l.address ?? ""} placeholder="Например: Ташкент, ул. Амира Темура, 15" className={fieldClass} />
              {!hasExactAddress(l.address) && <span className="mt-1 block text-xs text-amber-700">Указан только город или адрес пуст: карта на сайте не показывается. Добавьте улицу и дом.</span>}
            </Field>
            <Field label="Телефон"><input name={`phone:${l.id}`} maxLength={40} defaultValue={l.phone ?? ""} placeholder="+998 90 123 45 67" className={fieldClass} /></Field>
          </fieldset>
        ))}
      </FormShell>
    </div>
  );
}
