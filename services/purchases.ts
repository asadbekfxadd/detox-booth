import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canSwitchLocation } from "@/lib/rbac";
import { resolveLocation } from "@/services/inventory";
import { receiveIntoStock } from "@/services/receive";

type Actor = { id: string; role: string; locationId: string | null };
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date({ error: "Некорректная дата" }).nullable());
const qty = z.coerce.number({ error: "Укажите количество" }).positive("Количество должно быть больше 0").max(10_000_000, "Слишком большое количество");
const cost = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number({ error: "Укажите цену" }).min(0, "Цена не может быть отрицательной").max(100_000_000, "Слишком большая цена"));

function assertScope(user: Actor, locationId: string) {
  if (!canSwitchLocation(user.role) && user.locationId !== locationId) throw new ApiError(404, "Заказ не найден");
}

export const purchaseSchema = z.object({
  locationId: z.string().optional(),
  supplierId: z.string().min(1, "Выберите поставщика"),
  intent: z.enum(["draft", "ordered"]).default("ordered"),
  items: z.array(z.object({ ingredientId: z.string().min(1, "Выберите ингредиент в каждой позиции"), quantity: qty, unitCost: cost }))
    .min(1, "Добавьте хотя бы одну позицию").max(50, "Слишком много позиций"),
});

export async function createPurchase(input: unknown, user: Actor) {
  const d = purchaseSchema.parse(input);
  const locationId = resolveLocation(user, d.locationId);
  const total = d.items.reduce((a, i) => a.plus(D(i.quantity).times(i.unitCost)), D(0));
  const po = await prisma.$transaction(async (tx) => {
    if (!(await tx.supplier.findUnique({ where: { id: d.supplierId } }))) throw new ApiError(404, "Поставщик не найден");
    if (!(await tx.location.findUnique({ where: { id: locationId } }))) throw new ApiError(404, "Точка не найдена");
    const ids = [...new Set(d.items.map((i) => i.ingredientId))];
    if ((await tx.ingredient.count({ where: { id: { in: ids } } })) !== ids.length) throw new ApiError(404, "Ингредиент не найден");
    return tx.purchaseOrder.create({
      data: { locationId, supplierId: d.supplierId, status: d.intent === "draft" ? "DRAFT" : "ORDERED", total: total.toDecimalPlaces(2),
        items: { create: d.items.map((i) => ({ ingredientId: i.ingredientId, quantity: D(i.quantity), unitCost: D(i.unitCost) })) } },
    });
  });
  await audit({ userId: user.id, action: "PURCHASE_CREATED", entity: "PurchaseOrder", entityId: po.id, newValue: { locationId, supplierId: d.supplierId, status: po.status, total: Number(total), items: d.items.length } });
  return po.id;
}

export async function setPurchaseStatus(id: string, to: "ORDERED" | "CANCELLED", user: Actor) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new ApiError(404, "Заказ не найден");
  assertScope(user, po.locationId);
  const from = to === "ORDERED" ? ["DRAFT" as const] : ["DRAFT" as const, "ORDERED" as const];
  const r = await prisma.purchaseOrder.updateMany({ where: { id, status: { in: from } }, data: { status: to } });
  if (r.count === 0) throw new ApiError(400, "Статус заказа уже изменён, обновите страницу");
  await audit({ userId: user.id, action: "PURCHASE_STATUS_CHANGED", entity: "PurchaseOrder", entityId: id, oldValue: { status: po.status }, newValue: { status: to } });
}

export const receiveSchema = z.object({
  lines: z.array(z.object({ itemId: z.string().min(1), quantity: qty, unitCost: cost, expiresAt: optDate })).min(1, "В заказе нет позиций"),
});

export async function receivePurchase(id: string, input: unknown, user: Actor) {
  const d = receiveSchema.parse(input);
  const result = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!po) throw new ApiError(404, "Заказ не найден");
    assertScope(user, po.locationId);
    // атомарный переход статуса: повторная приёмка невозможна
    const lock = await tx.purchaseOrder.updateMany({ where: { id, status: { in: ["DRAFT", "ORDERED"] } }, data: { status: "RECEIVED", receivedAt: new Date() } });
    if (lock.count === 0) throw new ApiError(400, "Заказ уже принят или отменён");
    const lines = new Map(d.lines.map((l) => [l.itemId, l]));
    let total = D(0);
    for (const item of po.items) {
      const l = lines.get(item.id);
      const q = D(l?.quantity ?? item.quantity), c = D(l?.unitCost ?? item.unitCost), exp = l?.expiresAt ?? item.expiresAt;
      await tx.purchaseItem.update({ where: { id: item.id }, data: { quantity: q, unitCost: c, expiresAt: exp } });
      await receiveIntoStock(tx, { locationId: po.locationId, ingredientId: item.ingredientId, quantity: q, unitCost: c, expiresAt: exp, userId: user.id, refType: "PurchaseOrder", refId: po.id });
      total = total.plus(q.times(c));
    }
    await tx.purchaseOrder.update({ where: { id }, data: { total: total.toDecimalPlaces(2) } });
    return { total: Number(total), ordered: Number(po.total), items: po.items.length };
  });
  await audit({ userId: user.id, action: "PURCHASE_RECEIVED", entity: "PurchaseOrder", entityId: id, oldValue: { total: result.ordered }, newValue: { total: result.total, items: result.items } });
}

export async function listPurchases(locationId: string | null, status?: string) {
  const rows = await prisma.purchaseOrder.findMany({
    where: { ...(locationId ? { locationId } : {}), ...(status && status !== "all" ? { status: status as never } : {}) },
    orderBy: { createdAt: "desc" }, take: 200,
    include: { supplier: true, location: true, _count: { select: { items: true } } },
  });
  return rows.map((p) => ({ id: p.id, status: p.status, supplier: p.supplier.name, location: p.location.name, items: p._count.items, total: Number(p.total), createdAt: p.createdAt, receivedAt: p.receivedAt }));
}

export async function getPurchase(id: string, user: Actor) {
  const p = await prisma.purchaseOrder.findUnique({ where: { id }, include: { supplier: true, location: true, items: { include: { ingredient: true } } } });
  if (!p) return null;
  if (!canSwitchLocation(user.role) && user.locationId !== p.locationId) return null;
  return {
    id: p.id, status: p.status, supplier: p.supplier.name, location: p.location.name, total: Number(p.total), createdAt: p.createdAt, receivedAt: p.receivedAt,
    items: p.items.map((i) => ({ id: i.id, name: i.ingredient.name, unit: i.ingredient.unit, quantity: Number(i.quantity), unitCost: Number(i.unitCost), expiresAt: i.expiresAt })),
  };
}
