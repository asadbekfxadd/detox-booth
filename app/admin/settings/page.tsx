import { pageGuard } from "@/lib/guard";
import { SETTING_FIELDS, getSettingValues } from "@/services/settings";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { saveSettingsAction } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("settings.edit");
  const { ok } = await searchParams;
  const values = await getSettingValues();
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
    </div>
  );
}
