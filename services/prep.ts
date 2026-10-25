import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { lockStock } from "@/lib/stock-lock";
import { BASE_UNITS } from "@/lib/ingredient-units";
import { makesCycle, scalePrepItems } from "@/lib/prep";
import { resolveLocation, mustLocation, changeStock, maybeLowStock, fefoTake } from "@/services/inventory";

type Tx = Prisma.TransactionClient;
type Actor = { id: string; role: string; locationId: string | null };
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
const DAY = 86400000;
export const PREP_CATEGORY = "Заготовки";

const itemsSchema = z.array(z.object({
  ingredientId: z.string().min(1, "Выберите ингредиент"),
  quantity: z.coerce.number({ error: "Укажите количество" }).positive("Количество должно быть больше 0").max(10_000_000, "Слишком большое количество"),
})).min(1, "Добавьте хотя бы один ингредиент").max(30, "Слишком много ингредиентов")
  .refine((v) => new Set(v.map((i) => i.ingredientId)).size === v.length, { message: "Один ингредиент указан дважды" });

export const prepSchema = z.object({
  /** Есть: меняем существующую заготовку; нет: создаём новую */
  ingredientId: z.string().min(1).nullish(),
  name: z.string().trim().min(2, "Название: минимум 2 символа").max(80, "Слишком длинное название"),
  unit: z.enum(BASE_UNITS, { error: "Выберите единицу: граммы, миллилитры или штуки" }),
  outputQty: z.coerce.number({ error: "Укажите, сколько получается" }).positive("Выход должен быть больше 0").max(10_000_000, "Слишком большое количество"),
  shelfLifeDays: z.number().int("Срок — целое число дней").min(1, "Срок от 1 дня").max(3650, "Слишком большой срок").nullable(),
  items: itemsSchema,
});

/** Из чего что делается: для проверки циклов */
async function prepGraph(tx: Tx) {
  const rows = await tx.prepRecipeItem.findMany({ select: { ingredientId: true, prep: { select: { ingredientId: true } } } });
  const g = new Map<string, string[]>();
  for (const r of rows) g.set(r.prep.ingredientId, [...(g.get(r.prep.ingredientId) ?? []), r.ingredientId]);
  return g;
}

/** Создать или изменить заготовку. Заготовка — обычный ингредиент: её можно класть в рецепты, смотреть остаток, списывать. */
export async function savePrep(input: unknown, userId: string) {
  const d = prepSchema.parse(input);
  let ingredientId = d.ingredientId ?? null;
  if (ingredientId) {
    const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
    if (!ing) throw new ApiError(404, "Заготовка не найдена");
    if (d.unit !== ing.unit) {
      const used = await prisma.productionAct.count({ where: { ingredientId } }) + await prisma.stockItem.count({ where: { ingredientId } }) + await prisma.recipeItem.count({ where: { ingredientId } });
      if (used > 0) throw new ApiError(400, "Единицу нельзя менять: по заготовке уже есть остатки, акты или рецепты. Используйте «Перевести в другую единицу» в карточке ингредиента.");
    }
    const dup = await prisma.ingredient.findFirst({ where: { id: { not: ingredientId }, name: { equals: d.name, mode: "insensitive" } } });
    if (dup) throw new ApiError(400, `Ингредиент «${dup.name}» уже есть`);
  } else {
    const dup = await prisma.ingredient.findFirst({ where: { name: { equals: d.name, mode: "insensitive" } } });
    if (dup) throw new ApiError(400, `Ингредиент «${dup.name}» уже есть. Откройте его в разделе «Продукты и остатки» или назовите заготовку иначе.`);
  }
  const comps = d.items.map((i) => i.ingredientId);
  if (ingredientId && comps.includes(ingredientId)) throw new ApiError(400, "Заготовка не может состоять из самой себя");
  const found = await prisma.ingredient.count({ where: { id: { in: comps } } });
  if (found !== comps.length) throw new ApiError(400, "Один из ингредиентов не найден");

  const id = await prisma.$transaction(async (tx) => {
    if (!ingredientId) {
      // создаём ингредиент напрямую, чтобы не плодить вложенных транзакций
      const created = await createPrepIngredient(tx, d);
      ingredientId = created.id;
    } else {
      await tx.ingredient.update({ where: { id: ingredientId }, data: { name: d.name, unit: d.unit, shelfLifeDays: d.shelfLifeDays } });
    }
    if (makesCycle(await prepGraph(tx), ingredientId, comps)) throw new ApiError(400, "Получается круг: одна из заготовок в составе сама делается из этой. Уберите её из состава.");
    const prep = await tx.prepRecipe.upsert({ where: { ingredientId }, create: { ingredientId, outputQty: D(d.outputQty) }, update: { outputQty: D(d.outputQty) } });
    await tx.prepRecipeItem.deleteMany({ where: { prepId: prep.id } });
    await tx.prepRecipeItem.createMany({ data: d.items.map((i) => ({ prepId: prep.id, ingredientId: i.ingredientId, quantity: D(i.quantity) })) });
    return ingredientId;
  });
  await audit({ userId, action: "PREP_SAVED", entity: "Ingredient", entityId: id, newValue: { name: d.name, outputQty: d.outputQty, items: d.items, created: !d.ingredientId } });
  return id;
}

async function createPrepIngredient(tx: Tx, d: z.infer<typeof prepSchema>) {
  const rows = await tx.ingredient.findMany({ where: { sku: { startsWith: "ING-" } }, select: { sku: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(/^ING-(\d+)$/.exec(r.sku)?.[1] ?? 0)), 0);
  return tx.ingredient.create({ data: { sku: `ING-${String(max + 1).padStart(4, "0")}`, name: d.name, category: PREP_CATEGORY, unit: d.unit, minStock: D(0), maxStock: D(0), avgCost: D(0), shelfLifeDays: d.shelfLifeDays } });
}

export async function deletePrep(ingredientId: string, userId: string) {
  const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId }, include: { prepRecipe: true } });
  if (!ing?.prepRecipe) throw new ApiError(404, "Заготовка не найдена");
  const acts = await prisma.productionAct.count({ where: { ingredientId } });
  if (acts > 0) throw new ApiError(400, "По заготовке уже есть акты приготовления: рецепт убрать нельзя, но можно просто не готовить.");
  await prisma.prepRecipe.delete({ where: { id: ing.prepRecipe.id } });
  await audit({ userId, action: "PREP_DELETED", entity: "Ingredient", entityId: ingredientId, oldValue: { name: ing.name } });
}

export const produceSchema = z.object({
  locationId: z.string().optional(),
  ingredientId: z.string().min(1, "Выберите заготовку"),
  quantity: z.coerce.number({ error: "Укажите, сколько готовим" }).positive("Количество должно быть больше 0").max(10_000_000, "Слишком большое количество"),
  /** Сколько получилось на самом деле. Пусто: столько же, сколько планировали */
  actualQty: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number({ error: "Некорректное число" }).positive("Получилось должно быть больше 0").max(10_000_000).optional()),
  note: z.string().trim().max(200, "Комментарий слишком длинный").optional(),
});

/**
 * Акт приготовления: сырьё списывается (FEFO, только годное), заготовка оприходуется по реальной себестоимости
 * (стоимость списанных партий ÷ сколько получилось). Всё или ничего.
 */
export async function produce(input: unknown, user: Actor) {
  const d = produceSchema.parse(input);
  const locationId = resolveLocation(user, d.locationId);
  const res = await prisma.$transaction(async (tx) => {
    await lockStock(tx, locationId);
    await mustLocation(tx, locationId);
    const out = await tx.ingredient.findUnique({ where: { id: d.ingredientId }, include: { prepRecipe: { include: { items: { include: { ingredient: true } } } } } });
    if (!out?.prepRecipe) throw new ApiError(404, "У этого ингредиента нет рецепта заготовки");
    const planned = D(d.quantity);
    const actual = D(d.actualQty ?? d.quantity);
    const need = scalePrepItems(out.prepRecipe.items.map((i) => ({ ingredientId: i.ingredientId, quantity: Number(i.quantity) })), Number(out.prepRecipe.outputQty), d.quantity);

    const lines: { ing: (typeof out.prepRecipe.items)[number]["ingredient"]; qty: Prisma.Decimal; taken: Awaited<ReturnType<typeof fefoTake>>["taken"]; cost: Prisma.Decimal }[] = [];
    const short: string[] = [];
    for (const n of need) {
      const ing = out.prepRecipe.items.find((i) => i.ingredientId === n.ingredientId)!.ingredient;
      const qty = D(n.quantity);
      const stock = await tx.stockItem.findUnique({ where: { locationId_ingredientId: { locationId, ingredientId: ing.id } } });
      const usable = (await tx.batch.aggregate({ where: { locationId, ingredientId: ing.id, quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, _sum: { quantity: true } }))._sum.quantity ?? D(0);
      if (!stock || stock.quantity.lt(qty) || usable.lt(qty)) short.push(`${ing.name} (нужно ${qty.toString()}, годного ${Prisma.Decimal.min(usable, stock?.quantity ?? D(0)).toString()})`);
      lines.push({ ing, qty, taken: [], cost: D(0) });
    }
    if (short.length) throw new ApiError(400, `Не хватает на складе: ${short.join("; ")}. Сначала оформите приход.`);

    let total = D(0);
    for (const l of lines) {
      const { taken, left } = await fefoTake(tx, locationId, l.ing.id, l.qty, false);
      if (left.gt(0)) throw new ApiError(400, `Недостаточно годного: ${l.ing.name}`);
      l.taken = taken;
      l.cost = taken.reduce((a, t) => a.plus(t.qty.times(t.unitCost)), D(0));
      total = total.plus(l.cost);
    }
    total = total.toDecimalPlaces(2);
    const act = await tx.productionAct.create({ data: { locationId, ingredientId: out.id, plannedQty: planned, outputQty: actual, totalCost: total, note: d.note || null, userId: user.id } });
    await tx.productionActItem.createMany({ data: lines.map((l) => ({ actId: act.id, ingredientId: l.ing.id, quantity: l.qty, cost: l.cost.toDecimalPlaces(2) })) });
    for (const l of lines) {
      for (const t of l.taken)
        await tx.inventoryTransaction.create({ data: { locationId, ingredientId: l.ing.id, type: "PRODUCTION_OUT", quantity: t.qty.neg(), unitCost: t.unitCost, batchId: t.batchId, refType: "Production", refId: act.id, userId: user.id } });
      const now = await changeStock(tx, locationId, l.ing.id, l.qty.neg());
      await maybeLowStock(tx, locationId, l.ing, now);
    }
    // заготовка: партия с реальной себестоимостью и пересчёт средней цены
    const unitCost = actual.gt(0) ? total.div(actual).toDecimalPlaces(2) : D(0);
    const have = Prisma.Decimal.max(D(0), (await tx.stockItem.aggregate({ where: { ingredientId: out.id }, _sum: { quantity: true } }))._sum.quantity ?? D(0));
    const avg = have.plus(actual).gt(0) ? have.times(out.avgCost).plus(actual.times(unitCost)).div(have.plus(actual)) : unitCost;
    await tx.ingredient.update({ where: { id: out.id }, data: { avgCost: avg.toDecimalPlaces(2) } });
    const code = `${out.sku}-PR${act.number}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const batch = await tx.batch.create({ data: { locationId, ingredientId: out.id, code, quantity: actual, unitCost, expiresAt: out.shelfLifeDays ? new Date(Date.now() + out.shelfLifeDays * DAY) : null } });
    await tx.inventoryTransaction.create({ data: { locationId, ingredientId: out.id, type: "PRODUCTION_IN", quantity: actual, unitCost, batchId: batch.id, refType: "Production", refId: act.id, userId: user.id } });
    await changeStock(tx, locationId, out.id, actual);
    return { id: act.id, number: act.number, name: out.name, total: Number(total), unitCost: Number(unitCost), planned: d.quantity, actual: Number(actual), unit: out.unit };
  }, { timeout: 30_000, maxWait: 10_000 });
  await audit({ userId: user.id, action: "PRODUCTION_DONE", entity: "ProductionAct", entityId: res.id, newValue: { locationId, ingredientId: d.ingredientId, planned: res.planned, actual: res.actual, cost: res.total } });
  return res;
}

/** Все заготовки: состав, остаток, себестоимость порции сырья, когда готовили в последний раз */
export async function listPreps(locationId: string | null) {
  const rows = await prisma.ingredient.findMany({
    where: { prepRecipe: { isNot: null } },
    include: { prepRecipe: { include: { items: { include: { ingredient: { select: { name: true, unit: true, avgCost: true } } } } } }, stocks: locationId ? { where: { locationId } } : true },
    orderBy: { name: "asc" },
  });
  const last = await prisma.productionAct.groupBy({ by: ["ingredientId"], where: locationId ? { locationId } : {}, _max: { createdAt: true } });
  const lastBy = new Map(last.map((l) => [l.ingredientId, l._max.createdAt]));
  return rows.map((i) => {
    const p = i.prepRecipe!;
    const cost = p.items.reduce((a, it) => a + Number(it.quantity) * Number(it.ingredient.avgCost), 0);
    return {
      id: i.id, name: i.name, unit: i.unit as string, stock: i.stocks.reduce((a, s) => a + Number(s.quantity), 0),
      outputQty: Number(p.outputQty), components: p.items.length, estUnitCost: Number(p.outputQty) > 0 ? cost / Number(p.outputQty) : 0,
      avgCost: Number(i.avgCost), lastAt: lastBy.get(i.id) ?? null,
    };
  });
}

export async function getPrep(ingredientId: string, locationId: string | null) {
  const i = await prisma.ingredient.findUnique({
    where: { id: ingredientId },
    include: { prepRecipe: { include: { items: { include: { ingredient: true } } } }, stocks: locationId ? { where: { locationId } } : true },
  });
  if (!i?.prepRecipe) return null;
  const stocks = await prisma.stockItem.findMany({ where: { ingredientId: { in: i.prepRecipe.items.map((x) => x.ingredientId) }, ...(locationId ? { locationId } : {}) } });
  const stock = new Map<string, number>();
  for (const s of stocks) stock.set(s.ingredientId, (stock.get(s.ingredientId) ?? 0) + Number(s.quantity));
  return {
    id: i.id, name: i.name, unit: i.unit as string, shelfLifeDays: i.shelfLifeDays, outputQty: Number(i.prepRecipe.outputQty),
    stock: i.stocks.reduce((a, s) => a + Number(s.quantity), 0), avgCost: Number(i.avgCost),
    items: i.prepRecipe.items.map((x) => ({ ingredientId: x.ingredientId, name: x.ingredient.name, unit: x.ingredient.unit as string, quantity: Number(x.quantity), avgCost: Number(x.ingredient.avgCost), stock: stock.get(x.ingredientId) ?? 0 })),
  };
}

export async function listActs(locationId: string | null, limit = 30) {
  const rows = await prisma.productionAct.findMany({
    where: locationId ? { locationId } : {}, orderBy: { createdAt: "desc" }, take: limit,
    include: { ingredient: { select: { name: true, unit: true } }, location: { select: { name: true } }, items: { include: { ingredient: { select: { name: true, unit: true } } } } },
  });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } });
  const un = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id, number: r.number, at: r.createdAt, location: r.location.name, name: r.ingredient.name, unit: r.ingredient.unit as string,
    planned: Number(r.plannedQty), actual: Number(r.outputQty), cost: Number(r.totalCost), note: r.note, user: r.userId ? un.get(r.userId) ?? "—" : "—",
    items: r.items.map((x) => ({ name: x.ingredient.name, unit: x.ingredient.unit as string, quantity: Number(x.quantity), cost: Number(x.cost) })),
  }));
}

/** Список ингредиентов для выбора состава (без самой заготовки) */
export async function prepIngredientOptions() {
  const rows = await prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, unit: true, avgCost: true } });
  return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit as string, avgCost: Number(r.avgCost) }));
}
