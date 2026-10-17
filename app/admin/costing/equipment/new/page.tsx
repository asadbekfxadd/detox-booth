import { pageGuard } from "@/lib/guard";
import { listCostCategories } from "@/services/costing";
import { FormShell } from "@/components/admin/ops";
import { EquipmentFields } from "@/components/admin/EquipmentFields";
import { createEquipmentAction } from "../../actions";

export default async function NewEquipmentPage() {
  await pageGuard("finance.edit");
  const categories = await listCostCategories();
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">Новое оборудование</h1>
      <FormShell action={createEquipmentAction} submitLabel="Добавить" cancelHref="/admin/costing">
        <EquipmentFields categories={categories} />
      </FormShell>
    </div>
  );
}
