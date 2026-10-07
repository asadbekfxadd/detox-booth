import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Укажите название поставщика").max(100, "Слишком длинное название"),
  phone: z.string().trim().max(30, "Слишком длинный телефон").regex(/^[0-9+()\s-]*$/, "Телефон: только цифры, +, пробелы и скобки").optional().or(z.literal("")),
});

export async function listSuppliers() {
  const rows = await prisma.supplier.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { ingredients: true, purchases: true } } } });
  return rows.map((s) => ({ id: s.id, name: s.name, phone: s.phone, ingredients: s._count.ingredients, purchases: s._count.purchases }));
}

export const getSupplier = (id: string) => prisma.supplier.findUnique({ where: { id }, include: { ingredients: { select: { id: true, name: true }, orderBy: { name: "asc" } } } });

async function assertUniqueSupplier(name: string, exceptId?: string) {
  const dup = await prisma.supplier.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (dup) throw new ApiError(400, "Поставщик с таким названием уже есть");
}

export async function createSupplier(input: unknown, userId: string) {
  const d = supplierSchema.parse(input);
  await assertUniqueSupplier(d.name);
  const s = await prisma.supplier.create({ data: { name: d.name, phone: d.phone || null } });
  await audit({ userId, action: "SUPPLIER_CREATED", entity: "Supplier", entityId: s.id, newValue: d });
  return s.id;
}

export async function updateSupplier(id: string, input: unknown, userId: string) {
  const d = supplierSchema.parse(input);
  const old = await prisma.supplier.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Поставщик не найден");
  await assertUniqueSupplier(d.name, id);
  await prisma.supplier.update({ where: { id }, data: { name: d.name, phone: d.phone || null } });
  await audit({ userId, action: "SUPPLIER_UPDATED", entity: "Supplier", entityId: id, oldValue: { name: old.name, phone: old.phone }, newValue: d });
}

export async function deleteSupplier(id: string, userId: string) {
  const s = await prisma.supplier.findUnique({ where: { id }, include: { _count: { select: { purchases: true } } } });
  if (!s) throw new ApiError(404, "Поставщик не найден");
  if (s._count.purchases > 0) throw new ApiError(400, "Нельзя удалить поставщика: по нему есть закупки");
  await prisma.supplier.delete({ where: { id } });
  await audit({ userId, action: "SUPPLIER_DELETED", entity: "Supplier", entityId: id, oldValue: { name: s.name } });
}
