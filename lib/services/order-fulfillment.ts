import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLoyaltySettings } from "@/lib/loyalty-settings";
import { referralBonusTx } from "@/lib/services/loyalty";
import { lockStock } from "@/lib/stock-lock";
import { mixNeedsFromModifiers } from "@/lib/mix";
import { pickSizeRows } from "@/lib/recipe-size";
import { applyYield } from "@/services/availability";
import { lowStockMessage, lowStockPrefix, legacyLowStockPrefix } from "@/lib/notify";

type Tx = Prisma.TransactionClient;
type ChosenOption = { optionId: string };
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);

/**
 * Списание ингредиентов по заказу: рецепты -> FEFO -> InventoryTransaction -> StockItem -> COGS -> low-stock.
 * Статус заказа НЕ меняет. Идемпотентно (Order.inventoryDeducted).
 */
export async function deductInventoryTx(tx: Tx, orderId: string, userId?: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { product: { include: { recipe: { include: { items: true, sizeItems: true } } } } } } },
  });
  if (order.inventoryDeducted) return order;
  if (order.status === "CANCELLED") throw new Error("ORDER_CANCELLED");
  await lockStock(tx, order.locationId);
  // после блокировки перечитываем флаг: параллельная транзакция могла уже списать этот заказ
  if ((await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { inventoryDeducted: true } })).inventoryDeducted) return order;

  const netNeed = new Map<string, Prisma.Decimal>();
  const add = (id: string, q: Prisma.Decimal) => netNeed.set(id, (netNeed.get(id) ?? D(0)).plus(q));

  for (const item of order.items) {
    const mods = Array.isArray(item.modifiers) ? (item.modifiers as unknown as Partial<ChosenOption>[]) : [];
    const ids = mods.map((m) => m?.optionId).filter((x): x is string => typeof x === "string" && x.length > 0);
    const opts = ids.length ? await tx.modifierOption.findMany({ where: { id: { in: ids } } }) : [];
    const bySize = pickSizeRows(item.product.recipe?.sizeItems ?? [], opts.map((o) => o.id));
    if (bySize) for (const ri of bySize) add(ri.ingredientId, ri.quantity.times(item.quantity));
    else {
      const mult = opts.reduce((m, o) => m.times(o.recipeMultiplier), D(1));
      for (const ri of item.product.recipe?.items ?? []) add(ri.ingredientId, ri.quantity.times(mult).times(item.quantity));
    }
    for (const o of opts) if (o.extraIngredientId && o.extraQty) add(o.extraIngredientId, o.extraQty.times(item.quantity));
    // «Свой микс»: ингредиенты и стаканчик записаны в позиции заказа
    for (const n of mixNeedsFromModifiers(item.modifiers)) add(n.ingredientId, D(n.qty).times(item.quantity));
  }

  // в рецепте нетто, со склада уходит брутто (с учётом потерь при обработке)
  const need = await applyYield(tx, netNeed);
  let cogs = D(0);

  // точка без учёта склада: остатки и партии не трогаем, себестоимость считаем по средней цене закупки
  const loc = await tx.location.findUnique({ where: { id: order.locationId }, select: { trackStock: true } });
  if (loc && !loc.trackStock) {
    const ings = await tx.ingredient.findMany({ where: { id: { in: [...need.keys()] } }, select: { id: true, avgCost: true } });
    for (const i of ings) cogs = cogs.plus((need.get(i.id) ?? D(0)).times(i.avgCost));
    return tx.order.update({ where: { id: order.id }, data: { inventoryDeducted: true, cogs } });
  }
  for (const [ingredientId, qty] of need) {
    let left = qty;
    const batches = await tx.batch.findMany({
      where: { locationId: order.locationId, ingredientId, quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }], // FEFO
    });
    for (const b of batches) {
      if (left.lte(0)) break;
      const take = Prisma.Decimal.min(b.quantity, left);
      await tx.batch.update({ where: { id: b.id }, data: { quantity: { decrement: take } } });
      await tx.inventoryTransaction.create({ data: {
        locationId: order.locationId, ingredientId, type: "SALE", quantity: take.neg(),
        unitCost: b.unitCost, batchId: b.id, refType: "Order", refId: order.id, userId,
      } });
      cogs = cogs.plus(take.times(b.unitCost));
      left = left.minus(take);
    }
    if (left.gt(0)) { // партий не хватило: списываем по avgCost, расхождение увидит Variance
      const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
      await tx.inventoryTransaction.create({ data: {
        locationId: order.locationId, ingredientId, type: "SALE", quantity: left.neg(),
        unitCost: ing.avgCost, refType: "Order", refId: order.id, userId,
      } });
      cogs = cogs.plus(left.times(ing.avgCost));
    }

    const stock = await tx.stockItem.upsert({
      where: { locationId_ingredientId: { locationId: order.locationId, ingredientId } },
      create: { locationId: order.locationId, ingredientId, quantity: qty.neg() },
      update: { quantity: { decrement: qty } },
      include: { ingredient: true },
    });
    if (stock.quantity.lt(stock.ingredient.minStock)) {
      const exists = await tx.notification.findFirst({ where: { locationId: order.locationId, type: "LOW_STOCK", isRead: false, OR: [{ message: { startsWith: lowStockPrefix(stock.ingredient.name) } }, { message: { startsWith: legacyLowStockPrefix(stock.ingredient.name) } }] } });
      if (!exists)
        await tx.notification.create({ data: {
          locationId: order.locationId, type: "LOW_STOCK",
          message: lowStockMessage(stock.ingredient.name, stock.ingredient.unit, Number(stock.quantity), Number(stock.ingredient.minStock)),
        } });
    }
  }

  return tx.order.update({ where: { id: order.id }, data: { inventoryDeducted: true, cogs } });
}

/** Баллы клиенту за заказ. Идемпотентно: повторно не начисляет. */
export async function awardPointsTx(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.customerId || order.pointsEarned > 0) return order;
  await referralBonusTx(tx, order.customerId, order.id);
  const rate = (await getLoyaltySettings(tx)).earnRate; // баллов за 1 UZS
  const pointsEarned = Math.floor(Number(order.total) * rate);
  if (pointsEarned <= 0) return order;
  const acc = await tx.loyaltyAccount.upsert({
    where: { customerId: order.customerId },
    create: { customerId: order.customerId, points: pointsEarned },
    update: { points: { increment: pointsEarned } },
  });
  await tx.loyaltyTransaction.create({ data: { accountId: acc.id, type: "EARN", points: pointsEarned, orderId: order.id } });
  return tx.order.update({ where: { id: order.id }, data: { pointsEarned } });
}

/**
 * Оплаченный заказ -> списание -> баллы -> COMPLETED (для кассы: всё сразу).
 * Работает внутри переданной транзакции.
 */
export async function fulfillOrderTx(tx: Tx, orderId: string, userId?: string) {
  const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (current.status === "COMPLETED") return current;
  await deductInventoryTx(tx, orderId, userId);
  await awardPointsTx(tx, orderId);
  return tx.order.update({ where: { id: orderId }, data: { status: "COMPLETED", completedAt: new Date() } });
}

/** Отмена до выдачи: ингредиенты возвращаются в те же партии. Идемпотентно. */
export async function restockOrderTx(tx: Tx, orderId: string, userId?: string) {
  const lock = await tx.order.updateMany({ where: { id: orderId, inventoryDeducted: true }, data: { inventoryDeducted: false, cogs: 0 } });
  if (lock.count === 0) return false;
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const sales = await tx.inventoryTransaction.findMany({ where: { refType: "Order", refId: orderId, type: "SALE" } });
  const perIngredient = new Map<string, Prisma.Decimal>();
  for (const s of sales) {
    const back = s.quantity.abs();
    if (s.batchId) await tx.batch.update({ where: { id: s.batchId }, data: { quantity: { increment: back } } });
    await tx.inventoryTransaction.create({ data: {
      locationId: s.locationId, ingredientId: s.ingredientId, type: "ADJUSTMENT", quantity: back, unitCost: s.unitCost,
      batchId: s.batchId, refType: "OrderRestock", refId: orderId, userId,
    } });
    perIngredient.set(s.ingredientId, (perIngredient.get(s.ingredientId) ?? D(0)).plus(back));
  }
  for (const [ingredientId, q] of perIngredient)
    await tx.stockItem.upsert({
      where: { locationId_ingredientId: { locationId: order.locationId, ingredientId } },
      create: { locationId: order.locationId, ingredientId, quantity: q }, update: { quantity: { increment: q } },
    });
  return true;
}

/** Отдельный вызов вне транзакции. */
export function fulfillOrder(orderId: string, userId?: string) {
  return prisma.$transaction((tx) => fulfillOrderTx(tx, orderId, userId), { timeout: 20000, maxWait: 10000 });
}
