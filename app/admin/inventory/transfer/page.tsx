import { prisma } from "@/lib/prisma";
import { pageGuard, formLocations } from "@/lib/guard";
import { FormShell, Field, LocationField, fieldClass } from "@/components/admin/ops";
import { IngredientQty } from "@/components/admin/IngredientQty";
import { transferAction } from "../actions";

export default async function TransferPage() {
  await pageGuard("inventory.edit");
  const { options, defaultId, locations } = await formLocations();
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } });
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Перемещение между точками</h1>
      <FormShell action={transferAction} submitLabel="Переместить" cancelHref="/admin/inventory">
        <LocationField name="fromLocationId" label="Откуда" options={options} defaultValue={defaultId} />
        <Field label="Куда">
          <select name="toLocationId" required defaultValue="" className={fieldClass}>
            <option value="" disabled>Выберите…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <IngredientQty ingredients={ingredients} />
        <p className="text-xs text-neutral-500">Берутся партии с ближайшим сроком (FEFO), срок и цена партии сохраняются на новой точке. Просроченное не перемещается.</p>
      </FormShell>
    </div>
  );
}
