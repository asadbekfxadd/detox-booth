import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";

type Tx = Prisma.TransactionClient;
const DAY = 86400000;

/** Поступление на склад внутри чужой транзакции: партия + журнал + остаток + пересчёт средней цены. */
export async function receiveIntoStock(tx: Tx, p: {
  locationId: string; ingredientId: string; quantity: Prisma.Decimal; unitCost: Prisma.Decimal;
  expiresAt: Date | null; userId: string; refType: string; refId: string;
}) {
  const ing = await tx.ingredient.findUnique({ where: { id: p.ingredientId } });
  if (!ing) throw new ApiError(404, "Ингредиент не найден");
  const total = await tx.stockItem.aggregate({ where: { ingredientId: ing.id }, _sum: { quantity: true } });
  const have = Prisma.Decimal.max(new Prisma.Decimal(0), total._sum.quantity ?? new Prisma.Decimal(0));
  const sum = have.plus(p.quantity);
  const avg = sum.gt(0) ? have.times(ing.avgCost).plus(p.quantity.times(p.unitCost)).div(sum) : p.unitCost;
  await tx.ingredient.update({ where: { id: ing.id }, data: { avgCost: avg.toDecimalPlaces(2) } });
  const expiresAt = p.expiresAt ?? (ing.shelfLifeDays ? new Date(Date.now() + ing.shelfLifeDays * DAY) : null);
  const code = `${ing.sku}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const batch = await tx.batch.create({ data: { locationId: p.locationId, ingredientId: ing.id, code, quantity: p.quantity, unitCost: p.unitCost, expiresAt } });
  await tx.inventoryTransaction.create({ data: { locationId: p.locationId, ingredientId: ing.id, type: "PURCHASE", quantity: p.quantity, unitCost: p.unitCost, batchId: batch.id, refType: p.refType, refId: p.refId, userId: p.userId } });
  await tx.stockItem.upsert({
    where: { locationId_ingredientId: { locationId: p.locationId, ingredientId: ing.id } },
    create: { locationId: p.locationId, ingredientId: ing.id, quantity: p.quantity },
    update: { quantity: { increment: p.quantity } },
  });
  return batch.id;
}
