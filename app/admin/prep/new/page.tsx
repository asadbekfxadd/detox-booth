import { pageGuard } from "@/lib/guard";
import { can } from "@/lib/rbac";
import { prepIngredientOptions } from "@/services/prep";
import { PrepEditor } from "@/components/admin/PrepEditor";
import { savePrepAction } from "../actions";

export default async function NewPrepPage() {
  const user = await pageGuard("recipes.edit");
  const options = await prepIngredientOptions();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Новая заготовка</h1>
        <p className="text-sm text-neutral-500">Например, «Апельсиновый фреш»: из 11 кг апельсина получается 5 л сока. Заготовка появится в складе и рецептах как обычный продукт.</p>
      </div>
      <PrepEditor action={savePrepAction} options={options} showCost={can(user.role, "products.cost")} />
    </div>
  );
}
