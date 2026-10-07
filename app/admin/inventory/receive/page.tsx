import { prisma } from "@/lib/prisma";
import { pageGuard, formLocations } from "@/lib/guard";
import { FormShell, Field, LocationField, fieldClass } from "@/components/admin/ops";
import { IngredientQty } from "@/components/admin/IngredientQty";
import { stockInAction } from "../actions";

export default async function ReceivePage() {
  await pageGuard("inventory.edit");
  const { options, defaultId } = await formLocations();
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } });
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Приход товара</h1>
      <FormShell action={stockInAction} submitLabel="Оформить приход" cancelHref="/admin/inventory">
        <LocationField options={options} defaultValue={defaultId} />
        <IngredientQty ingredients={ingredients} withCost />
        <Field label="Срок годности (пусто = по умолчанию для ингредиента)"><input name="expiresAt" type="date" className={fieldClass} /></Field>
        <p className="text-xs text-neutral-500">Остаток ведётся в граммах, миллилитрах и штуках. Для г и мл можно вводить в кг и л: система сама пересчитает. Создаётся новая партия, средняя цена ингредиента пересчитывается.</p>
      </FormShell>
    </div>
  );
}
