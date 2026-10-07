import { pageGuard } from "@/lib/guard";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { createCategoryAction } from "../actions";

export default async function NewCategoryPage() {
  await pageGuard("products.edit");
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Новая категория</h1>
      <FormShell action={createCategoryAction} submitLabel="Добавить" cancelHref="/admin/categories">
        <Field label="Название"><input name="name" required maxLength={40} className={fieldClass} /></Field>
        <Field label="Порядок в меню (меньше — выше)"><input name="sort" type="number" min="0" step="1" defaultValue="0" className={fieldClass} /></Field>
      </FormShell>
    </div>
  );
}
