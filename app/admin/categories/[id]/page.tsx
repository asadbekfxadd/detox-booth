import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { getCategory } from "@/services/categories";
import { updateCategoryAction } from "../actions";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("products.edit");
  const { id } = await params;
  const c = await getCategory(id);
  if (!c) notFound();
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">{c.name}</h1>
      <FormShell action={updateCategoryAction} submitLabel="Сохранить" cancelHref="/admin/categories">
        <input type="hidden" name="id" value={c.id} />
        <Field label="Название"><input name="name" required maxLength={40} defaultValue={c.name} className={fieldClass} /></Field>
        <Field label="Порядок в меню (меньше — выше)"><input name="sort" type="number" min="0" step="1" defaultValue={c.sort} className={fieldClass} /></Field>
      </FormShell>
    </div>
  );
}
