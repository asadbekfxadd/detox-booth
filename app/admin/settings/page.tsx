import { pageGuard } from "@/lib/guard";
import { SETTING_FIELDS, getSettingValues } from "@/services/settings";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { listLocationContacts } from "@/services/locations";
import { hasMap } from "@/lib/brand";
import { saveSettingsAction, saveLocationsAction, createLocationAction, resetStockAction } from "./actions";
import { ResetStockForm } from "@/components/admin/ResetStockForm";
import { RESET_STOCK_WORD } from "@/services/inventory";

/** Одна строка простым языком: что настраивается в разделе */
const GROUP_INFO: Record<string, string> = {
  "Баллы клиентов": "Сколько баллов гости получают за покупки и как могут ими платить",
  "Заказы": "Доставка и время выдачи заказов",
  "Столы": "Сервисный сбор за столом",
  "Бронь столов": "Можно ли бронировать на сайте, часы, депозит, лимиты",
  "Себестоимость": "Аренда, зарплаты, потери: чтобы верно считать, во сколько обходится напиток",
  "Касса и склад": "Лимит скидки кассира и порог крупного списания",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; loc?: string; reset?: string; added?: string; mgr?: string }> }) {
  const me = await pageGuard("settings.edit");
  const { ok, loc, reset, added, mgr } = await searchParams;
  const [values, locations] = await Promise.all([getSettingValues(), listLocationContacts()]);
  const groups = [...new Set(SETTING_FIELDS.map((f) => f.group))];
  return (
    <div className="max-w-2xl space-y-5">
      <div><h1 className="text-2xl font-bold">Настройки</h1><p className="text-sm text-neutral-500">Здесь меняются правила работы заведения. Изменения применяются сразу и записываются в журнал действий. Не уверены в значении, оставьте как есть.</p></div>
      {ok != null && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{ok === "0" ? "Изменений нет" : `Настройки сохранены (изменено: ${ok})`}</p>}
      <FormShell action={saveSettingsAction} submitLabel="Сохранить" cancelHref="/admin/settings">
        {groups.map((g) => (
          <details key={g} className="group rounded-xl border border-neutral-200 bg-white open:border-green-300">
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
              <span><span className="block font-bold text-green-800">{g}</span><span className="block text-sm text-neutral-500">{GROUP_INFO[g]}</span></span>
              <span className="shrink-0 text-sm text-neutral-400 group-open:hidden">Открыть</span>
              <span className="hidden shrink-0 text-sm text-neutral-400 group-open:inline">Свернуть</span>
            </summary>
            <div className="space-y-4 border-t border-neutral-100 p-4">
              {SETTING_FIELDS.filter((f) => f.group === g).map((f) => (
                <Field key={f.key} label={f.label}>
                  {f.toggle ? (
                    <select name={f.key} defaultValue={String(values[f.key])} className={fieldClass}>
                      <option value="1">Включено</option><option value="0">Выключено</option>
                    </select>
                  ) : (
                    <input name={f.key} type="number" required min={f.min} max={f.max} step={f.step} defaultValue={values[f.key]} className={fieldClass} />
                  )}
                  <span className="mt-1 block text-xs text-neutral-500">{f.hint}</span>
                </Field>
              ))}
            </div>
          </details>
        ))}
        <p className="text-xs text-neutral-500">Откройте нужный раздел, измените значения и нажмите «Сохранить»: сохраняются сразу все разделы.</p>
      </FormShell>

      <div id="locations" className="scroll-mt-4 border-t border-neutral-200 pt-5">
        <h2 className="text-lg font-bold">Адрес и телефон точек</h2>
        <p className="text-sm text-neutral-500">Адрес и телефон показываются клиентам. Внизу сайта появляется карта, если заданы координаты или точный адрес (улица и дом).</p>
      </div>
      {added != null && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">Точка «{added}» добавлена{mgr ? ", менеджер создан (передайте ему email и пароль лично)" : ""}. Дальше: оприходуйте товар в «Склад → Приход» и добавьте сотрудников в «Сотрудники»; при доставке задайте зоны.</p>}
      <details className="group rounded-xl border border-neutral-200 bg-white open:border-green-300">
        <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
          <span><span className="block font-bold text-green-800">Добавить точку (новый филиал)</span><span className="block text-sm text-neutral-500">Откроется в меню сайта и в кассе, склад начнётся с нуля</span></span>
          <span className="shrink-0 text-sm text-neutral-400 group-open:hidden">Открыть</span>
          <span className="hidden shrink-0 text-sm text-neutral-400 group-open:inline">Свернуть</span>
        </summary>
        <div className="border-t border-neutral-100 p-4">
          <FormShell action={createLocationAction} submitLabel="Добавить точку" cancelHref="/admin/settings">
            <Field label="Название точки"><input name="name" required minLength={2} maxLength={60} placeholder="Например: Vitamin B Sergeli" className={fieldClass} /></Field>
            <Field label="Адрес"><input name="address" maxLength={200} placeholder="Ташкент, ул. Амира Темура, 15" className={fieldClass} /></Field>
            <Field label="Координаты (необязательно)"><input name="coords" maxLength={40} placeholder="41.103801, 69.043818" className={fieldClass} /></Field>
            <Field label="Телефон"><input name="phone" maxLength={40} placeholder="+998 90 123 45 67" className={fieldClass} /></Field>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="untracked" className="mt-1" /><span><b>Продавать без учёта склада</b>: всё сразу можно заказать, остатки не ведутся. Позже можно включить учёт склада в этом же разделе.</span></label>
            <fieldset className="space-y-3 rounded-lg bg-neutral-50 p-3">
              <legend className="px-1 text-sm font-bold">Учётка менеджера точки (необязательно)</legend>
              <p className="text-xs text-neutral-500">Заполните все три поля, и менеджер получит вход сразу. Остальных сотрудников можно добавить позже в «Сотрудники».</p>
              <Field label="Имя"><input name="managerName" maxLength={80} autoComplete="off" className={fieldClass} /></Field>
              <Field label="Email (логин)"><input name="managerEmail" type="email" maxLength={120} autoComplete="off" className={fieldClass} /></Field>
              <Field label="Пароль (минимум 8 символов)"><input name="managerPassword" type="text" minLength={8} maxLength={72} autoComplete="off" className={fieldClass} /></Field>
            </fieldset>
          </FormShell>
        </div>
      </details>
      {loc != null && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{loc === "0" ? "Изменений нет" : `Точки сохранены (изменено: ${loc})`}</p>}
      <FormShell action={saveLocationsAction} submitLabel="Сохранить точки" cancelHref="/admin/settings">
        {locations.map((l) => (
          <fieldset key={l.id} className="space-y-3">
            <input type="hidden" name="id" value={l.id} />
            <legend className="mb-1 text-sm font-bold text-green-800">{l.name}</legend>
            <Field label="Название точки">
              <input name={`name:${l.id}`} required minLength={2} maxLength={60} defaultValue={l.name} className={fieldClass} />
              <span className="mt-1 block text-xs text-neutral-500">Видно гостям на сайте, в заказах и отчётах. Старые заказы покажут новое название.</span>
            </Field>
            <Field label="Адрес">
              <input name={`address:${l.id}`} maxLength={200} defaultValue={l.address ?? ""} placeholder="Например: Ташкент, ул. Амира Темура, 15" className={fieldClass} />
              {!hasMap(l) && <span className="mt-1 block text-xs text-amber-700">Указан только город или адрес пуст: карта на сайте не показывается. Добавьте улицу и дом или координаты.</span>}
            </Field>
            <Field label="Координаты (точнее адреса)">
              <input name={`coords:${l.id}`} maxLength={40} defaultValue={l.lat != null && l.lng != null ? `${l.lat}, ${l.lng}` : ""} placeholder="41.103801, 69.043818" className={fieldClass} />
              <span className="mt-1 block text-xs text-neutral-500">В Яндекс или Google Картах нажмите на точку и скопируйте координаты. Широта и долгота через запятую.</span>
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name={`untracked:${l.id}`} defaultChecked={!l.trackStock} className="mt-1" />
              <span><b>Продавать без учёта склада</b>: все позиции считаются в наличии, заказать можно сразу, без прихода товара. Остатки на этой точке не ведутся и не списываются, себестоимость считается по средней цене закупки.</span>
            </label>
            <Field label="Телефон"><input name={`phone:${l.id}`} maxLength={40} defaultValue={l.phone ?? ""} placeholder="+998 90 123 45 67" className={fieldClass} /></Field>
          </fieldset>
        ))}
      </FormShell>

      {me.role === "OWNER" && (
        <div id="reset" className="scroll-mt-4 space-y-3 border-t border-neutral-200 pt-5">
          <h2 className="text-lg font-bold text-red-700">Обнулить остатки склада</h2>
          {reset != null && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">Остатки обнулены (позиций: {reset}). Теперь оприходуйте реальные остатки.</p>}
          <ResetStockForm action={resetStockAction} locations={locations.map((l) => ({ id: l.id, name: l.name }))} word={RESET_STOCK_WORD} />
        </div>
      )}
    </div>
  );
}
