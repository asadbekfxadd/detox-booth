import { pageGuard } from "@/lib/guard";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { createSupplierAction } from "../actions";

export default async function NewSupplierPage() {
  await pageGuard("purchases.manage");
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Новый поставщик</h1>
      <FormShell action={createSupplierAction} submitLabel="Добавить" cancelHref="/admin/suppliers">
        <Field label="Название"><input name="name" required className={fieldClass} /></Field>
        <Field label="Телефон"><input name="phone" placeholder="+998 90 123 45 67" className={fieldClass} /></Field>
      </FormShell>
    </div>
  );
}
