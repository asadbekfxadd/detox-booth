import { pageGuard } from "@/lib/guard";
import { getMixAdmin, SUGGESTED_SIZES } from "@/services/mix";
import { MIX_MAX_SIZES } from "@/lib/mix";
import { FormShell, fieldClass } from "@/components/admin/ops";
import { smallLabel } from "@/lib/ingredient-units";
import { saveMixAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Свой микс" };

export default async function MixAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("products.edit");
  const sp = await searchParams;
  const m = await getMixAdmin();
  // пока размеры не сохранены, показываем подсказку: владелец проверяет цены и сохраняет — тогда микс включается
  const rows = m.sizes.length ? m.sizes : m.configured ? [] : SUGGESTED_SIZES.map((x) => ({ ...x, id: "" }));
  const sizeRows = Array.from({ length: MIX_MAX_SIZES }, (_, i) => rows[i] ?? null);
  const inMix = m.ingredients.filter((i) => i.mixable).length;
  const noWeight = m.ingredients.filter((i) => !i.mixable);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Свой микс</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Гость (на сайте) и кассир или официант (по просьбе гостя) сами выбирают ингредиенты. Цена = цена размера + доплата за каждый выбранный ингредиент.
          Масса состава стакана делится между выбранными ингредиентами поровну, и столько же списывается со склада.
        </p>
      </div>
      {sp.ok && <p role="status" className="rounded-lg bg-lime-50 px-3 py-2 text-sm font-semibold text-green-900">Сохранено.</p>}
      {!m.configured && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Микс пока выключен: на сайте и в кассе его нет. Проверьте размеры и цены ниже и нажмите «Сохранить», чтобы включить.
        </p>
      )}

      <FormShell action={saveMixAction} submitLabel="Сохранить" cancelHref="/admin/mix">
        <section className="space-y-3">
          <h2 className="font-bold">Размеры стакана</h2>
          <p className="text-xs text-neutral-500">Чтобы убрать размер, сотрите его название. Все размеры убраны — микс выключен.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm [&_td]:px-1 [&_td]:py-1 [&_th]:px-1 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-neutral-500">
              <thead><tr><th>Название</th><th>Цена, UZS</th><th>Масса состава, г</th><th>Стаканчик со склада</th></tr></thead>
              <tbody>
                {sizeRows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input type="hidden" name={`size_id_${i}`} defaultValue={r?.id ?? ""} />
                      <input name={`size_name_${i}`} defaultValue={r?.name ?? ""} placeholder={i === 0 ? "400 мл" : ""} maxLength={24} aria-label={`Название размера ${i + 1}`} className={fieldClass} />
                    </td>
                    <td><input name={`size_price_${i}`} defaultValue={r?.price ?? ""} inputMode="decimal" aria-label={`Цена размера ${i + 1}`} className={fieldClass} /></td>
                    <td><input name={`size_grams_${i}`} defaultValue={r?.grams ?? ""} inputMode="decimal" aria-label={`Масса состава размера ${i + 1}`} className={fieldClass} /></td>
                    <td>
                      <select name={`size_cup_${i}`} defaultValue={r?.cupIngredientId ?? ""} aria-label={`Стаканчик размера ${i + 1}`} className={fieldClass}>
                        <option value="">Не списывать</option>
                        {m.packaging.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">Масса состава — сколько граммов фруктов и овощей идёт в стакан. Для стакана 400 мл обычно 450–550 г. Стаканчик выбирается из ингредиентов категории «Упаковка».</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-bold">Ингредиенты и доплаты</h2>
          <p className="text-xs text-neutral-500">
            Гость может выбрать любой ингредиент со склада точки (упаковку нельзя). Доплата прибавляется к цене стакана, если ингредиент выбран: поставьте её дорогим (манго, авокадо), у остальных оставьте 0.
          </p>
          {noWeight.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Ингредиентам в штуках нужен вес одной штуки, иначе их нельзя положить в микс: {noWeight.map((i) => i.name).join(", ")}.
            </p>
          )}
          <input type="hidden" name="ingredientIds" value={m.ingredients.map((i) => i.id).join(",")} />
          {m.ingredients.length === 0 ? <p className="text-sm text-neutral-500">На складе пока нет ингредиентов. Добавьте их в разделе «Склад».</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-neutral-500">
                <thead><tr><th>Ингредиент</th><th>Категория</th><th>Доплата, UZS</th><th>Вес штуки, г</th></tr></thead>
                <tbody>
                  {m.ingredients.map((i) => (
                    <tr key={i.id} className="border-t border-neutral-100">
                      <td className="font-medium">{i.name} <span className="text-xs font-normal text-neutral-400">{smallLabel(i.unit)}</span></td>
                      <td className="text-neutral-500">{i.category}</td>
                      <td><input name={`sur_${i.id}`} defaultValue={i.surcharge || ""} placeholder="0" inputMode="decimal" aria-label={`Доплата: ${i.name}`} className={`${fieldClass} max-w-36`} /></td>
                      <td>{i.unit === "PC"
                        ? <input name={`pw_${i.id}`} defaultValue={i.pieceWeightG ?? ""} inputMode="decimal" aria-label={`Вес штуки: ${i.name}`} className={`${fieldClass} max-w-28`} />
                        : <span className="text-neutral-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-neutral-500">В миксе доступно ингредиентов: {inMix}.</p>
        </section>
      </FormShell>
    </div>
  );
}
