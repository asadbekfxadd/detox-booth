import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { getEquipment, listCostCategories } from "@/services/costing";
import { FormShell } from "@/components/admin/ops";
import { EquipmentFields } from "@/components/admin/EquipmentFields";
import { ActionButton } from "@/components/admin/ActionButton";
import { updateEquipmentAction, toggleEquipmentAction, deleteEquipmentAction } from "../../actions";
import { money } from "@/lib/format";

export default async function EquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  await pageGuard("finance.edit");
  const { id } = await params;
  const [e, categories] = await Promise.all([getEquipment(id), listCostCategories()]);
  if (!e) notFound();
  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold">{e.name}</h1>
      {!e.isActive && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">Оборудование выключено и не входит в себестоимость. Включите его, когда оно снова в работе.</p>}
      <FormShell action={updateEquipmentAction} submitLabel="Сохранить" cancelHref="/admin/costing">
        <input type="hidden" name="id" value={e.id} />
        <EquipmentFields categories={categories} v={e} />
        <p className="text-sm text-neutral-600">Амортизация: {money(e.price / e.lifeDrinks)} за напиток</p>
      </FormShell>
      <div className="flex flex-wrap items-start gap-3">
        <ActionButton action={toggleEquipmentAction} fields={{ id: e.id, active: e.isActive ? "0" : "1" }} label={e.isActive ? "Выключить из калькуляции" : "Включить в калькуляцию"} danger={e.isActive} />
        <ActionButton action={deleteEquipmentAction} fields={{ id: e.id }} label="Удалить" danger confirmText="Удалить оборудование? Себестоимость напитков пересчитается без него." />
      </div>
    </div>
  );
}
