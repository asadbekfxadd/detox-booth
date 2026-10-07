import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/slug";

const schema = z.object({
  name: z.string().trim().min(2, "Укажите название категории").max(40, "Слишком длинное название"),
  sort: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number({ error: "Порядок — число" }).int("Порядок — целое число").min(0, "Порядок не может быть отрицательным").max(10000, "Слишком большое число")),
});

async function uniqueSlug(name: string, exceptId?: string) {
  const base = slugify(name);
  for (let i = 0; ; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    const hit = await prisma.category.findUnique({ where: { slug } });
    if (!hit || hit.id === exceptId) return slug;
  }
}
async function assertUniqueName(name: string, exceptId?: string) {
  const dup = await prisma.category.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (dup) throw new ApiError(400, "Категория с таким названием уже есть");
}

export const listCategories = () => prisma.category.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
export const getCategory = (id: string) => prisma.category.findUnique({ where: { id } });

export async function createCategory(input: unknown, userId: string) {
  const d = schema.parse(input);
  await assertUniqueName(d.name);
  const c = await prisma.category.create({ data: { name: d.name, sort: d.sort, slug: await uniqueSlug(d.name) } });
  await audit({ userId, action: "CATEGORY_CREATED", entity: "Category", entityId: c.id, newValue: { name: c.name, sort: c.sort } });
}

export async function updateCategory(id: string, input: unknown, userId: string) {
  const d = schema.parse(input);
  const old = await getCategory(id);
  if (!old) throw new ApiError(404, "Категория не найдена");
  await assertUniqueName(d.name, id);
  // slug не меняем при переименовании, чтобы не ломать ссылки на сайте
  await prisma.category.update({ where: { id }, data: { name: d.name, sort: d.sort } });
  await audit({ userId, action: "CATEGORY_UPDATED", entity: "Category", entityId: id, oldValue: { name: old.name, sort: old.sort }, newValue: { name: d.name, sort: d.sort } });
}

export async function deleteCategory(id: string, userId: string) {
  const c = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!c) throw new ApiError(404, "Категория не найдена");
  if (c._count.products > 0) throw new ApiError(400, "В категории есть продукты — сначала перенесите их в другую категорию");
  await prisma.category.delete({ where: { id } });
  await audit({ userId, action: "CATEGORY_DELETED", entity: "Category", entityId: id, oldValue: { name: c.name } });
}
