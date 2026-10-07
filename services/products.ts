import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/slug";

const optNum = (max: number, int = false) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), (int ? z.coerce.number().int() : z.coerce.number()).min(0).max(max).nullable());
const bool = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
const emptyToNull = (v: unknown) => (v === "" ? null : v);

export const productSchema = z.object({
  name: z.string().trim().min(2, "Название: минимум 2 символа").max(80, "Название слишком длинное"),
  description: z.preprocess(emptyToNull, z.string().trim().max(500, "Описание: максимум 500 символов").nullable().optional()),
  categoryId: z.string().min(1, "Выберите категорию"),
  price: z.coerce.number({ error: "Укажите цену" }).int("Цена — целое число").min(1, "Цена должна быть больше 0").max(10_000_000, "Слишком большая цена"),
  image: z.preprocess(emptyToNull, z.string().trim().url("Некорректная ссылка на фото").nullable().optional()),
  calories: optNum(5000, true), protein: optNum(500), carbs: optNum(500), fat: optNum(500), volumeMl: optNum(5000, true),
  prepMinutes: z.coerce.number().int().min(0).max(120).default(3),
  allergens: z.preprocess((v) => (typeof v === "string" ? v.split(",").map((x) => x.trim()).filter(Boolean) : v), z.array(z.string().max(30)).max(15).default([])),
  isVegan: bool, isHighProtein: bool, isSugarFree: bool, isAvailable: bool,
});
export const productPatchSchema = productSchema.partial();

async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let i = 0; ; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    if (!(await prisma.product.findUnique({ where: { slug } }))) return slug;
  }
}
async function assertUniqueName(name: string, exceptId?: string) {
  const dup = await prisma.product.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (dup) throw new ApiError(400, "Продукт с таким названием уже есть");
}
const plain = (o: unknown) => JSON.parse(JSON.stringify(o));

export async function listProducts(f: { q?: string; categoryId?: string; status?: string }, withCost: boolean) {
  const rows = await prisma.product.findMany({
    where: {
      ...(f.status === "archived" ? { isArchived: true } : f.status === "all" ? {} : { isArchived: false }),
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
      ...(f.q ? { name: { contains: f.q, mode: "insensitive" as const } } : {}),
    },
    include: { category: true, _count: { select: { orderItems: true } }, recipe: { include: { items: { include: { ingredient: true } } } } },
    orderBy: [{ category: { sort: "asc" } }, { name: "asc" }],
  });
  return rows.map((p) => ({
    id: p.id, name: p.name, category: p.category.name, price: Number(p.price), image: p.image,
    cost: withCost && p.recipe ? p.recipe.items.reduce((a, i) => a + Number(i.quantity) * Number(i.ingredient.avgCost), 0) : null,
    isAvailable: p.isAvailable, isArchived: p.isArchived, orders: p._count.orderItems,
  }));
}

export async function createProduct(input: unknown, userId: string) {
  const data = productSchema.parse(input);
  const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!cat) throw new ApiError(400, "Категория не найдена");
  await assertUniqueName(data.name);
  const p = await prisma.product.create({ data: { ...data, name: data.name.trim(), slug: await uniqueSlug(data.name) } });
  await audit({ userId, action: "PRODUCT_CREATED", entity: "Product", entityId: p.id, newValue: plain({ name: p.name, price: p.price }) });
  return p;
}

export async function updateProduct(id: string, input: unknown, userId: string) {
  const data = productPatchSchema.parse(input);
  const old = await prisma.product.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Продукт не найден");
  if (data.name) await assertUniqueName(data.name, id);
  const p = await prisma.product.update({ where: { id }, data });
  if (data.price !== undefined && Number(old.price) !== data.price)
    await audit({ userId, action: "PRODUCT_PRICE_CHANGED", entity: "Product", entityId: id, oldValue: { price: Number(old.price) }, newValue: { price: data.price } });
  await audit({ userId, action: "PRODUCT_UPDATED", entity: "Product", entityId: id, oldValue: plain(old), newValue: plain(p) });
  return p;
}

async function flag(id: string, patch: { isArchived?: boolean; isAvailable?: boolean }, action: string, userId: string) {
  const old = await prisma.product.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Продукт не найден");
  await prisma.product.update({ where: { id }, data: patch });
  await audit({ userId, action, entity: "Product", entityId: id, oldValue: { isArchived: old.isArchived, isAvailable: old.isAvailable }, newValue: patch });
}
export const setArchived = (id: string, v: boolean, userId: string) =>
  flag(id, v ? { isArchived: true, isAvailable: false } : { isArchived: false }, v ? "PRODUCT_ARCHIVED" : "PRODUCT_RESTORED", userId);
export const setAvailable = (id: string, v: boolean, userId: string) => flag(id, { isAvailable: v }, "PRODUCT_AVAILABILITY", userId);

export async function deleteProduct(id: string, userId: string) {
  const used = await prisma.orderItem.count({ where: { productId: id } });
  if (used > 0) throw new ApiError(409, "Продукт есть в заказах — его можно только архивировать");
  const old = await prisma.product.delete({ where: { id } });
  await audit({ userId, action: "PRODUCT_DELETED", entity: "Product", entityId: id, oldValue: plain({ name: old.name, price: old.price }) });
}
