import { QuickProduct } from "@/components/admin/QuickProduct";

export default function QuickProductPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Создать продукт по описанию</h1>
        <p className="text-sm text-neutral-500">Напишите текстом, что за продукт и из чего он. Карточка, рецепт, размеры и описание создадутся сами, а продукт сразу появится в меню.</p>
      </div>
      <QuickProduct />
    </div>
  );
}
