import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canSwitchLocation } from "@/lib/rbac";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { lockStock } from "@/lib/stock-lock";

type Tx = Prisma.TransactionClient;
type Actor = { id: string; role: string; locationId: string | null };
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
const DAY = 86400000;
const VARIANCE_ALERT_UZS = 50_000;

/** Не-владелец работает только со своей точкой, что бы ни пришло из формы. */
export function resolveLocation(user: Actor, requested?: string | null) {
  if (!canSwitchLocation(user.role)) {
    if (!user.locationId) throw new ApiError(403, "За вами не закреплена точка");
    return user.locationId;
  }
  if (!requested) throw new ApiError(400, "Выберите точку");
  return requested;
}

const qty = z.coerce.number({ error: "Укажите количество" }).positive("Количество должно быть больше 0").max(10_000_000, "Слишком большое количество");
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date({ error: "Некорректная дата" }).nullable());
const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();

async function mustIngredient(tx: Tx, id: string) {
  const i = await tx.ingredient.findUnique({ where: { id } });
  if (!i) throw new ApiError(404, "Ингредиент не найден");
  return i;
}
async function mustLocation(tx: Tx, id: string) {
  if (!(await tx.location.findUnique({ where: { id } }))) throw new ApiError(404, "Точка не найдена");
}
async function changeStock(tx: Tx, locationId: string, ingredientId: string, delta: Prisma.Decimal) {
  const s = await tx.stockItem.upsert({
    where: { locationId_ingredientId: { locationId, ingredientId } },
    create: { locationId, ingredientId, quantity: delta },
    update: { quantity: { increment: delta } },
  });
  return s.quantity;
}
async function maybeLowStock(tx: Tx, locationId: string, ing: { name: string; unit: string; minStock: Prisma.Decimal }, now: Prisma.Decimal) {
  if (now.gte(ing.minStock)) return;
  const prefix = `LOW STOCK: ${ing.name}`;
  const exists = await tx.notification.findFirst({ where: { locationId, type: "LOW_STOCK", isRead: false, message: { startsWith: prefix } } });
  if (!exists) await tx.notification.create({ data: { locationId, type: "LOW_STOCK", message: `${prefix} — ${now} ${ing.unit} (min ${ing.minStock})` } });
}
/** FEFO: сначала партии с ближайшим сроком годности. */
async function fefoTake(tx: Tx, locationId: string, ingredientId: string, need: Prisma.Decimal, allowExpired: boolean) {
  const batches = await tx.batch.findMany({
    where: { locationId, ingredientId, quantity: { gt: 0 }, ...(allowExpired ? {} : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }) },
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
  });
  let left = need;
  const taken: { batchId: string; qty: Prisma.Decimal; unitCost: Prisma.Decimal; expiresAt: Date | null }[] = [];
  for (const b of batches) {
    if (left.lte(0)) break;
    const take = Prisma.Decimal.min(b.quantity, left);
    await tx.batch.update({ where: { id: b.id }, data: { quantity: { decrement: take } } });
    taken.push({ batchId: b.id, qty: take, unitCost: b.unitCost, expiresAt: b.expiresAt });
    left = left.minus(take);
  }
  return { taken, left };
}

// ---------- Приход ----------
export const stockInSchema = z.object({
  locationId: z.string().optional(),
  ingredientId: z.string().min(1, "Выберите ингредиент"),
  quantity: qty,
  unitCost: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number({ error: "Укажите цену" }).min(0, "Цена не может быть отрицательной").max(100_000_000)),
  expiresAt: optDate,
});

export async function stockIn(input: unknown, user: Actor) {
  const d = stockInSchema.parse(input);
  const locationId = resolveLocation(user, d.locationId);
  const batchId = await prisma.$transaction(async (tx) => {
    await lockStock(tx, locationId);
    const ing = await mustIngredient(tx, d.ingredientId);
    await mustLocation(tx, locationId);
    const total = await tx.stockItem.aggregate({ where: { ingredientId: ing.id }, _sum: { quantity: true } });
    const have = Prisma.Decimal.max(D(0), total._sum.quantity ?? D(0));
    const q = D(d.quantity), c = D(d.unitCost);
    const avg = have.plus(q).gt(0) ? have.times(ing.avgCost).plus(q.times(c)).div(have.plus(q)) : c;
    await tx.ingredient.update({ where: { id: ing.id }, data: { avgCost: avg.toDecimalPlaces(2) } });
    const expiresAt = d.expiresAt ?? (ing.shelfLifeDays ? new Date(Date.now() + ing.shelfLifeDays * DAY) : null);
    const batch = await tx.batch.create({ data: { locationId, ingredientId: ing.id, code: `${ing.sku}-${stamp()}`, quantity: q, unitCost: c, expiresAt } });
    await tx.inventoryTransaction.create({ data: { locationId, ingredientId: ing.id, type: "PURCHASE", quantity: q, unitCost: c, batchId: batch.id, refType: "StockIn", refId: batch.id, userId: user.id } });
    await changeStock(tx, locationId, ing.id, q);
    return batch.id;
  });
  await audit({ userId: user.id, action: "STOCK_IN", entity: "Batch", entityId: batchId, newValue: { locationId, ingredientId: d.ingredientId, quantity: d.quantity, unitCost: d.unitCost } });
}

// ---------- Списание ----------
export const WRITE_OFF_REASONS = ["EXPIRED", "SPOILED", "DAMAGED", "PRODUCTION_WASTE", "EMPLOYEE_ERROR", "OTHER"] as const;
export const writeOffSchema = z.object({
  locationId: z.string().optional(),
  ingredientId: z.string().min(1, "Выберите ингредиент"),
  quantity: qty,
  reason: z.enum(WRITE_OFF_REASONS, { error: "Выберите причину" }),
});

export async function writeOff(input: unknown, user: Actor) {
  const d = writeOffSchema.parse(input);
  const locationId = resolveLocation(user, d.locationId);
  const res = await prisma.$transaction(async (tx) => {
    await lockStock(tx, locationId);
    const ing = await mustIngredient(tx, d.ingredientId);
    await mustLocation(tx, locationId);
    const stock = await tx.stockItem.findUnique({ where: { locationId_ingredientId: { locationId, ingredientId: ing.id } } });
    const q = D(d.quantity);
    if (!stock || stock.quantity.lt(q)) throw new ApiError(400, "На складе меньше, чем вы пытаетесь списать");
    const { taken, left } = await fefoTake(tx, locationId, ing.id, q, true); // списывать можно и просроченное
    let cost = taken.reduce((a, t) => a.plus(t.qty.times(t.unitCost)), D(0));
    if (left.gt(0)) cost = cost.plus(left.times(ing.avgCost));
    const w = await tx.writeOff.create({ data: { locationId, ingredientId: ing.id, quantity: q, reason: d.reason, cost: cost.toDecimalPlaces(2), userId: user.id } });
    for (const t of taken)
      await tx.inventoryTransaction.create({ data: { locationId, ingredientId: ing.id, type: "WRITE_OFF", quantity: t.qty.neg(), unitCost: t.unitCost, batchId: t.batchId, refType: "WriteOff", refId: w.id, userId: user.id } });
    if (left.gt(0))
      await tx.inventoryTransaction.create({ data: { locationId, ingredientId: ing.id, type: "WRITE_OFF", quantity: left.neg(), unitCost: ing.avgCost, refType: "WriteOff", refId: w.id, userId: user.id } });
    const now = await changeStock(tx, locationId, ing.id, q.neg());
    await maybeLowStock(tx, locationId, ing, now);
    const th = await tx.setting.findUnique({ where: { key: "writeoff.largeThreshold" } });
    if (cost.gte((th?.value as number | undefined) ?? 200_000))
      await tx.notification.create({ data: { locationId, type: "LARGE_WRITE_OFF", message: `LARGE WRITE-OFF: ${ing.name} ${d.quantity} ${ing.unit} на ${cost.toFixed(0)} UZS (${d.reason})` } });
    return { id: w.id, cost: Number(cost) };
  });
  await audit({ userId: user.id, action: "WRITEOFF_CREATED", entity: "WriteOff", entityId: res.id, newValue: { locationId, ingredientId: d.ingredientId, quantity: d.quantity, reason: d.reason, cost: res.cost } });
}

// ---------- Перемещение между точками ----------
export const transferSchema = z.object({
  fromLocationId: z.string().optional(),
  toLocationId: z.string().min(1, "Выберите точку назначения"),
  ingredientId: z.string().min(1, "Выберите ингредиент"),
  quantity: qty,
});

export async function transfer(input: unknown, user: Actor) {
  const d = transferSchema.parse(input);
  const from = resolveLocation(user, d.fromLocationId);
  if (from === d.toLocationId) throw new ApiError(400, "Точки отправления и назначения совпадают");
  await prisma.$transaction(async (tx) => {
    await lockStock(tx, from, d.toLocationId);
    const ing = await mustIngredient(tx, d.ingredientId);
    await mustLocation(tx, from); await mustLocation(tx, d.toLocationId);
    const q = D(d.quantity);
    const stock = await tx.stockItem.findUnique({ where: { locationId_ingredientId: { locationId: from, ingredientId: ing.id } } });
    if (!stock || stock.quantity.lt(q)) throw new ApiError(400, "На складе меньше, чем вы пытаетесь переместить");
    const { taken, left } = await fefoTake(tx, from, ing.id, q, false);
    if (left.gt(0)) throw new ApiError(400, "Недостаточно годного товара: часть партий просрочена или не оформлена");
    for (const t of taken) {
      const nb = await tx.batch.create({ data: { locationId: d.toLocationId, ingredientId: ing.id, code: `${ing.sku}-TR-${stamp()}`, quantity: t.qty, unitCost: t.unitCost, expiresAt: t.expiresAt } });
      await tx.inventoryTransaction.create({ data: { locationId: from, ingredientId: ing.id, type: "TRANSFER_OUT", quantity: t.qty.neg(), unitCost: t.unitCost, batchId: t.batchId, refType: "Transfer", refId: nb.id, userId: user.id } });
      await tx.inventoryTransaction.create({ data: { locationId: d.toLocationId, ingredientId: ing.id, type: "TRANSFER_IN", quantity: t.qty, unitCost: t.unitCost, batchId: nb.id, refType: "Transfer", refId: nb.id, userId: user.id } });
    }
    const now = await changeStock(tx, from, ing.id, q.neg());
    await changeStock(tx, d.toLocationId, ing.id, q);
    await maybeLowStock(tx, from, ing, now);
  });
  await audit({ userId: user.id, action: "STOCK_TRANSFER", entity: "Ingredient", entityId: d.ingredientId, newValue: { from, to: d.toLocationId, quantity: d.quantity } });
}

// ---------- Инвентаризация (факт vs система) ----------
export const countSchema = z.object({
  locationId: z.string().optional(),
  items: z.array(z.object({ ingredientId: z.string().min(1), actual: z.coerce.number({ error: "Некорректное число" }).min(0, "Остаток не может быть отрицательным").max(10_000_000) }))
    .min(1, "Введите фактический остаток хотя бы для одного ингредиента").max(100),
});

export async function countInventory(input: unknown, user: Actor) {
  const d = countSchema.parse(input);
  const locationId = resolveLocation(user, d.locationId);
  const results = await prisma.$transaction(async (tx) => {
    await lockStock(tx, locationId);
    await mustLocation(tx, locationId);
    const out: { ing: Awaited<ReturnType<typeof mustIngredient>>; expected: Prisma.Decimal; actual: Prisma.Decimal; variance: Prisma.Decimal }[] = [];
    for (const it of d.items) {
      const ing = await mustIngredient(tx, it.ingredientId);
      const stock = await tx.stockItem.findUnique({ where: { locationId_ingredientId: { locationId, ingredientId: ing.id } } });
      const expected = stock?.quantity ?? D(0), actual = D(it.actual), variance = actual.minus(expected);
      // партии приводим к факту, чтобы остаток и партии не расходились
      const bsum = (await tx.batch.aggregate({ where: { locationId, ingredientId: ing.id }, _sum: { quantity: true } }))._sum.quantity ?? D(0);
      const diff = actual.minus(bsum);
      if (diff.gt(0))
        await tx.batch.create({ data: { locationId, ingredientId: ing.id, code: `${ing.sku}-CNT-${stamp()}`, quantity: diff, unitCost: ing.avgCost, expiresAt: ing.shelfLifeDays ? new Date(Date.now() + ing.shelfLifeDays * DAY) : null } });
      else if (diff.lt(0)) await fefoTake(tx, locationId, ing.id, diff.neg(), true);
      if (!variance.isZero())
        await tx.inventoryTransaction.create({ data: { locationId, ingredientId: ing.id, type: "COUNT", quantity: variance, unitCost: ing.avgCost, refType: "Count", userId: user.id } });
      await tx.stockItem.upsert({
        where: { locationId_ingredientId: { locationId, ingredientId: ing.id } },
        create: { locationId, ingredientId: ing.id, quantity: actual }, update: { quantity: actual },
      });
      await maybeLowStock(tx, locationId, ing, actual);
      out.push({ ing, expected, actual, variance });
    }
    return out;
  });
  for (const r of results) {
    const cost = Number(r.variance.times(r.ing.avgCost));
    await audit({ userId: user.id, action: "INVENTORY_COUNT", entity: "Ingredient", entityId: r.ing.id,
      oldValue: { expected: Number(r.expected) }, newValue: { locationId, actual: Number(r.actual), variance: Number(r.variance), cost } });
    if (Math.abs(cost) >= VARIANCE_ALERT_UZS)
      await prisma.notification.create({ data: { locationId, type: "INVENTORY_VARIANCE", message: `INVENTORY VARIANCE: ${r.ing.name} ${Number(r.variance) > 0 ? "+" : ""}${Number(r.variance)} ${r.ing.unit} (${Math.round(cost)} UZS)` } });
  }
  return results.length;
}

// ---------- Чтение ----------
export async function getStockOverview(locationId: string | null) {
  const loc = locationId ? { locationId } : {};
  const [ings, stocks, batches, locs] = await Promise.all([
    prisma.ingredient.findMany({ include: { supplier: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockItem.findMany({ where: loc }),
    prisma.batch.findMany({ where: { ...loc, quantity: { gt: 0 }, expiresAt: { not: null } }, select: { ingredientId: true, expiresAt: true } }),
    prisma.location.findMany({ select: { id: true, name: true } }),
  ]);
  const lname = new Map(locs.map((l) => [l.id, l.name]));
  return ings.map((i) => {
    const mine = stocks.filter((s) => s.ingredientId === i.id);
    const min = Number(i.minStock);
    const exp = batches.filter((b) => b.ingredientId === i.id).map((b) => b.expiresAt!.getTime());
    return {
      id: i.id, sku: i.sku, name: i.name, category: i.category, unit: i.unit, min, max: Number(i.maxStock), cost: Number(i.avgCost),
      supplier: i.supplier?.name ?? null,
      total: mine.reduce((a, s) => a + Number(s.quantity), 0),
      low: mine.some((s) => Number(s.quantity) < min),
      perLocation: locationId ? null : mine.map((s) => ({ name: lname.get(s.locationId) ?? "?", qty: Number(s.quantity), low: Number(s.quantity) < min })),
      nearestExpiry: exp.length ? new Date(Math.min(...exp)) : null,
    };
  });
}

export async function listBatches(locationId: string | null) {
  const rows = await prisma.batch.findMany({
    where: { ...(locationId ? { locationId } : {}), quantity: { gt: 0 } },
    include: { ingredient: true, location: true },
    orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
  });
  const now = Date.now();
  return rows.map((b) => ({
    id: b.id, code: b.code, ingredient: b.ingredient.name, unit: b.ingredient.unit, location: b.location.name,
    quantity: Number(b.quantity), unitCost: Number(b.unitCost), receivedAt: b.receivedAt, expiresAt: b.expiresAt,
    status: !b.expiresAt ? "ok" : b.expiresAt.getTime() < now ? "expired" : b.expiresAt.getTime() < now + 3 * DAY ? "soon" : "ok",
  }));
}

export async function listVariances(locationId: string | null) {
  const logs = await prisma.auditLog.findMany({
    where: { action: "INVENTORY_COUNT", ...(locationId ? { newValue: { path: ["locationId"], equals: locationId } } : {}) },
    orderBy: { createdAt: "desc" }, take: 150, include: { user: { select: { name: true } } },
  });
  const [ings, locs] = await Promise.all([prisma.ingredient.findMany({ select: { id: true, name: true, unit: true } }), prisma.location.findMany({ select: { id: true, name: true } })]);
  const im = new Map(ings.map((i) => [i.id, i])), lm = new Map(locs.map((l) => [l.id, l.name]));
  return logs.map((l) => {
    const o = (l.oldValue ?? {}) as { expected?: number }, n = (l.newValue ?? {}) as { locationId?: string; actual?: number; variance?: number; cost?: number };
    const ing = im.get(l.entityId ?? "");
    return { id: l.id, date: l.createdAt, ingredient: ing?.name ?? "—", unit: ing?.unit ?? "", location: lm.get(n.locationId ?? "") ?? "—",
      expected: o.expected ?? 0, actual: n.actual ?? 0, variance: n.variance ?? 0, cost: n.cost ?? 0, user: l.user?.name ?? "—" };
  });
}

export async function listWriteOffs(locationId: string | null) {
  const rows = await prisma.writeOff.findMany({
    where: locationId ? { locationId } : {}, orderBy: { createdAt: "desc" }, take: 100,
    include: { ingredient: true, user: { select: { name: true } }, location: true },
  });
  return rows.map((w) => ({ id: w.id, date: w.createdAt, ingredient: w.ingredient.name, unit: w.ingredient.unit, location: w.location.name,
    quantity: Number(w.quantity), reason: w.reason, cost: Number(w.cost), user: w.user.name }));
}
