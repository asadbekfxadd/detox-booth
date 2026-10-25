import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { resolveLocation } from "@/services/inventory";
import { createPurchase } from "@/services/purchases";
import { suggestQty } from "@/lib/auto-order";

type Actor = { id: string; role: string; locationId: string | null };
const DAY = 86400000;
export const DEFAULT_COVER_DAYS = 7;
export const DEFAULT_LEAD_DAYS = 2;

export type Suggested = {
  ingredientId: string; name: string; unit: string; supplierId: string | null; supplier: string | null;
  stock: number; onOrder: number; min: number; avgDaily: number; daysLeft: number | null; qty: number; unitCost: number; reason: "below_min" | "runs_out";
};

/** Что нужно заказать на точку: по минимальным остаткам и среднему расходу за 30 дней, с учётом уже заказанного. */
export async function getSuggestions(locationId: string, opts: { coverDays?: number; leadDays?: number } = {}): Promise<Suggested[]> {
  const coverDays = Math.min(60, Math.max(1, opts.coverDays ?? DEFAULT_COVER_DAYS));
  const leadDays = Math.min(30, Math.max(0, opts.leadDays ?? DEFAULT_LEAD_DAYS));
  const since = new Date(Date.now() - 30 * DAY);
  const [ings, stocks, open, used, prices] = await Promise.all([
    prisma.ingredient.findMany({ include: { supplier: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.stockItem.findMany({ where: { locationId } }),
    prisma.purchaseItem.groupBy({ by: ["ingredientId"], where: { purchase: { locationId, status: { in: ["DRAFT", "ORDERED"] } } }, _sum: { quantity: true } }),
    prisma.inventoryTransaction.groupBy({ by: ["ingredientId"], where: { locationId, createdAt: { gte: since }, type: { in: ["SALE", "PRODUCTION_OUT"] } }, _sum: { quantity: true } }),
    prisma.purchaseItem.findMany({ where: { purchase: { status: "RECEIVED" } }, orderBy: { purchase: { receivedAt: "desc" } }, distinct: ["ingredientId"], select: { ingredientId: true, unitCost: true } }),
  ]);
  const stock = new Map(stocks.map((s) => [s.ingredientId, Number(s.quantity)]));
  const onOrder = new Map(open.map((o) => [o.ingredientId, Number(o._sum.quantity ?? 0)]));
  const daily = new Map(used.map((u) => [u.ingredientId, Math.max(0, -Number(u._sum.quantity ?? 0)) / 30]));
  const last = new Map(prices.map((p) => [p.ingredientId, Number(p.unitCost)]));
  const out: Suggested[] = [];
  for (const i of ings) {
    const s = suggestQty({ stock: stock.get(i.id) ?? 0, onOrder: onOrder.get(i.id) ?? 0, min: Number(i.minStock), max: Number(i.maxStock), avgDaily: daily.get(i.id) ?? 0, coverDays, leadDays, unit: i.unit });
    if (s.qty <= 0 || !s.reason) continue;
    out.push({
      ingredientId: i.id, name: i.name, unit: i.unit as string, supplierId: i.supplierId, supplier: i.supplier?.name ?? null,
      stock: stock.get(i.id) ?? 0, onOrder: onOrder.get(i.id) ?? 0, min: Number(i.minStock), avgDaily: daily.get(i.id) ?? 0, daysLeft: s.daysLeft, qty: s.qty,
      unitCost: last.get(i.id) ?? Number(i.avgCost), reason: s.reason,
    });
  }
  return out;
}

export const draftSchema = z.object({
  locationId: z.string().optional(),
  lines: z.array(z.object({ ingredientId: z.string().min(1), quantity: z.coerce.number({ error: "Укажите количество" }).positive("Количество должно быть больше 0").max(10_000_000, "Слишком большое количество") }))
    .min(1, "Отметьте хотя бы одну позицию").max(300, "Слишком много позиций"),
});

/**
 * Создаёт черновики закупок: по одному на поставщика. Ничего не заказывает: откройте черновик, проверьте и нажмите «Оформить заказ».
 * Цена берётся из последней приёмки, а если её нет, из средней цены ингредиента.
 */
export async function createDraftOrders(input: unknown, user: Actor) {
  const d = draftSchema.parse(input);
  const locationId = resolveLocation(user, d.locationId);
  const ids = [...new Set(d.lines.map((l) => l.ingredientId))];
  if (ids.length !== d.lines.length) throw new ApiError(400, "Один ингредиент указан дважды");
  const ings = await prisma.ingredient.findMany({ where: { id: { in: ids } }, include: { supplier: { select: { name: true } } } });
  if (ings.length !== ids.length) throw new ApiError(404, "Ингредиент не найден");
  const noSupplier = ings.filter((i) => !i.supplierId).map((i) => i.name);
  if (noSupplier.length) throw new ApiError(400, `У этих продуктов не указан поставщик: ${noSupplier.join(", ")}. Укажите его в карточке продукта.`);
  const prices = await prisma.purchaseItem.findMany({ where: { ingredientId: { in: ids }, purchase: { status: "RECEIVED" } }, orderBy: { purchase: { receivedAt: "desc" } }, distinct: ["ingredientId"], select: { ingredientId: true, unitCost: true } });
  const last = new Map(prices.map((p) => [p.ingredientId, Number(p.unitCost)]));
  const bySupplier = new Map<string, { ingredientId: string; quantity: number; unitCost: number }[]>();
  for (const l of d.lines) {
    const ing = ings.find((i) => i.id === l.ingredientId)!;
    const list = bySupplier.get(ing.supplierId!) ?? [];
    list.push({ ingredientId: ing.id, quantity: l.quantity, unitCost: last.get(ing.id) ?? Number(ing.avgCost) });
    bySupplier.set(ing.supplierId!, list);
  }
  const created: string[] = [];
  for (const [supplierId, items] of bySupplier) created.push(await createPurchase({ locationId, supplierId, intent: "draft", items }, user));
  await audit({ userId: user.id, action: "PURCHASE_AUTO_DRAFTED", entity: "PurchaseOrder", entityId: created[0], newValue: { locationId, orders: created, lines: d.lines.length } });
  return created;
}
