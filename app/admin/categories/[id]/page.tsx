import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { getCategory } from "@/services/categories";
import { stationOptions } from "@/services/stations";
import { updateCategoryAction } from "../actions";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("products.edit");
  const { id } = await params;
  const [c, stations] = await Promise.all([getCategory(id), stationOptions()]);
  if (!c) notFound();
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">{c.name}</h1>
      <FormShell action={updateCategoryAction} submitLabel="Сохранить" cancelHref="/admin/categories">
        <input type="hidden" name="id" value={c.id} />
        <Field label="Название"><input name="name" required maxLength={40} defaultValue={c.name} className={fieldClass} /></Field>
        <Field label="Порядок в меню (меньше — выше)"><input name="sort" type="number" min="0" step="1" defaultValue={c.sort} className={fieldClass} /></Field>
        {stations.length > 0 && (
          <Field label="Станция кухни (куда печатать и где готовить)">
            <select name="stationId" defaultValue={c.stationId ?? ""} className={fieldClass}><option value="">Без станции</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </Field>
        )}
      </FormShell>
    </div>
  );
}
