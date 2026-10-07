import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { ProductForm } from "@/components/admin/ProductForm";
import { updateProductAction } from "../actions";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { modifiers: { include: { options: true } }, recipe: { include: { items: true } } } }),
    prisma.category.findMany({ orderBy: { sort: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!p) notFound();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{p.name}</h1>
      <ProductForm categories={categories} submitLabel="Сохранить" action={updateProductAction.bind(null, id)}
        initial={{ name: p.name, description: p.description, categoryId: p.categoryId, price: Number(p.price), image: p.image,
          calories: p.calories, protein: p.protein ? Number(p.protein) : null, carbs: p.carbs ? Number(p.carbs) : null,
          fat: p.fat ? Number(p.fat) : null, volumeMl: p.volumeMl, prepMinutes: p.prepMinutes, allergens: p.allergens,
          isVegan: p.isVegan, isHighProtein: p.isHighProtein, isSugarFree: p.isSugarFree, isAvailable: p.isAvailable }} />
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-semibold">Модификаторы и рецепт</h2>
        <p className="mb-3 text-sm text-neutral-500">Рецепт: {p.recipe ? `${p.recipe.items.length} ингредиентов` : "не задан"}. Редактор рецептов и модификаторов — на шаге 8.</p>
        {p.modifiers.length === 0 ? <p className="text-sm text-neutral-500">Модификаторов нет.</p> : (
          <ul className="space-y-1 text-sm">
            {p.modifiers.map((m) => (
              <li key={m.id}><b>{m.name}</b>: {m.options.map((o) => `${o.name}${Number(o.priceDelta) ? ` (+${money(Number(o.priceDelta))})` : ""}`).join(", ")}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
