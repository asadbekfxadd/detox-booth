import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { getSupplier } from "@/services/suppliers";
import { FormShell, Field, fieldClass } from "@/components/admin/ops";
import { ActionButton } from "@/components/admin/ActionButton";
import { updateSupplierAction, deleteSupplierAction } from "../actions";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("purchases.manage");
  const { id } = await params;
  const s = await getSupplier(id);
  if (!s) notFound();
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">{s.name}</h1>
      <FormShell action={updateSupplierAction} submitLabel="Сохранить" cancelHref="/admin/suppliers">
        <input type="hidden" name="id" value={s.id} />
        <Field label="Название"><input name="name" defaultValue={s.name} required className={fieldClass} /></Field>
        <Field label="Телефон"><input name="phone" defaultValue={s.phone ?? ""} className={fieldClass} /></Field>
      </FormShell>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="mb-2 text-sm font-semibold">Поставляет ({s.ingredients.length})</p>
        <p className="text-sm text-neutral-600">{s.ingredients.length ? s.ingredients.map((i) => i.name).join(", ") : "Ингредиенты не привязаны"}</p>
      </div>
      <ActionButton action={deleteSupplierAction} fields={{ id: s.id }} label="Удалить поставщика" danger confirmText="Удалить поставщика? Это действие нельзя отменить." />
    </div>
  );
}
