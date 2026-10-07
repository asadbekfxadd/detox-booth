import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/ProductForm";
import { createProductAction } from "../actions";

export default async function NewProduct() {
  const categories = await prisma.category.findMany({ orderBy: { sort: "asc" }, select: { id: true, name: true } });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Новый продукт</h1>
      <ProductForm categories={categories} action={createProductAction} submitLabel="Создать" />
    </div>
  );
}
