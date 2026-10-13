import { pageGuard } from "@/lib/guard";
import { getBrand } from "@/services/brand";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { saveBrandAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бренд и сайт" };

export default async function BrandPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("settings.edit");
  const { ok } = await searchParams;
  const b = await getBrand();
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Бренд и сайт</h1>
        <p className="text-sm text-neutral-500">Название, логотип, цвета и тексты сайта, подвала, кассы и входа. Изменения видны сразу (до 20 секунд на самом сайте).</p>
      </div>
      {ok != null && <p className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{ok === "0" ? "Изменений нет" : "Бренд сохранён"}</p>}
      <FormShell action={saveBrandAction} submitLabel="Сохранить" cancelHref="/admin/brand">
        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-bold uppercase tracking-wide text-green-800">Название</legend>
          <Field label="Название заведения">
            <input name="name" required maxLength={40} defaultValue={b.name} className={fieldClass} />
            <span className="mt-1 block text-xs text-neutral-500">Последнее слово в логотипе подсвечивается акцентным цветом.</span>
          </Field>
          <Field label="Подпись под названием"><input name="descriptor" maxLength={40} defaultValue={b.descriptor} placeholder="Например: кофейня и выпечка" className={fieldClass} /></Field>
          <Field label="Короткая фраза"><input name="tagline" maxLength={60} defaultValue={b.tagline} className={fieldClass} /></Field>
          <Field label="Заголовок вкладки и поиска"><input name="seoTitle" maxLength={70} defaultValue={b.seoTitle} placeholder="Если пусто: название и подпись" className={fieldClass} /></Field>
          <Field label="Описание для поисковиков и ссылок"><textarea name="description" rows={2} maxLength={220} defaultValue={b.description} className={fieldClass} /></Field>
          <Field label="Текст в подвале"><input name="footerText" maxLength={160} defaultValue={b.footerText} className={fieldClass} /></Field>
          <Field label="Instagram">
            <input name="instagram" maxLength={80} defaultValue={b.instagram} placeholder="ник или ссылка" className={fieldClass} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-bold uppercase tracking-wide text-green-800">Логотип и цвета</legend>
          <Field label="Ссылка на логотип">
            <input name="logoUrl" maxLength={300} defaultValue={b.logoUrl} placeholder="https://… или /brand/logo.png" className={fieldClass} />
            <span className="mt-1 block text-xs text-neutral-500">Квадратный или вертикальный знак на прозрачном фоне. Если пусто, покажем монограмму из первой буквы названия.</span>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Основной цвет (заголовки, тёмные блоки)">
              <input name="primary" type="color" defaultValue={b.primary} className="h-10 w-full cursor-pointer rounded-lg border border-neutral-200 bg-white p-1" />
            </Field>
            <Field label="Акцентный цвет (кнопки, выделения)">
              <input name="accent" type="color" defaultValue={b.accent} className="h-10 w-full cursor-pointer rounded-lg border border-neutral-200 bg-white p-1" />
            </Field>
          </div>
          <p className="text-xs text-neutral-500">Остальные оттенки сайта считаются от этих двух. Если цвет делает текст нечитаемым, система предупредит.</p>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-bold uppercase tracking-wide text-green-800">Главная страница</legend>
          <Field label="Вид главной">
            <select name="homeStyle" defaultValue={b.homeStyle} className={fieldClass}>
              <option value="classic">Универсальная (для любого заведения)</option>
              <option value="vitaminb">Витрина Vitamin B (фото, подборки по настроению)</option>
            </select>
          </Field>
          <Field label="Заголовок (универсальная главная)"><input name="heroTitle" maxLength={80} defaultValue={b.heroTitle} placeholder="Если пусто, возьмём название" className={fieldClass} /></Field>
          <Field label="Текст под заголовком"><textarea name="heroText" rows={2} maxLength={220} defaultValue={b.heroText} placeholder="Закажите онлайн и заберите готовым" className={fieldClass} /></Field>
          <Field label="Фото на главной (ссылка)"><input name="heroImage" maxLength={300} defaultValue={b.heroImage} placeholder="https://…" className={fieldClass} /></Field>
          <Field label="Бегущая строка вверху сайта (по одной фразе в строке)">
            <textarea name="ticker" rows={5} defaultValue={b.ticker.join("\n")} className={fieldClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="assistant" defaultChecked={b.assistant} /> Показывать помощницу-мандаринку на сайте</label>
        </fieldset>
      </FormShell>
    </div>
  );
}
