import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { resolveMix } from "@/services/mix";
import type { MixInput } from "@/lib/mix";
import { pickSizeRows } from "@/lib/recipe-size";

type Db = Prisma.TransactionClient;
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
/**
 * mix — «Свой микс» из корзины (состав считаем по базе); mixNeeds — уже сохранённый микс в заказе (состав записан в позиции).
 */
export type CartItem = { productId: string; quantity: number; optionIds: string[]; mix?: MixInput; mixNeeds?: { ingredientId: string; qty: number }[] };

/** Остаток, который реально можно продать: только непросроченные партии точки. */
export async function usableStock(db: Db, locationId: string) {
  const rows = await db.batch.groupBy({
    by: ["ingredientId"],
    where: { locationId, quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.ingredientId, r._sum.quantity ?? D(0)]));
}

/** Сколько каждого ингредиента нужно на корзину (рецепт × множитель опций × количество + доп. ингредиенты). */
export async function computeNeeds(db: Db, items: CartItem[]) {
  const products = await db.product.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.productId))] } },
    include: { recipe: { include: { items: true, sizeItems: true } } },
  });
  const pm = new Map(products.map((p) => [p.id, p]));
  const optionIds = [...new Set(items.flatMap((i) => i.optionIds))];
  const opts = optionIds.length ? await db.modifierOption.findMany({ where: { id: { in: optionIds } } }) : [];
  const om = new Map(opts.map((o) => [o.id, o]));
  const need = new Map<string, Prisma.Decimal>();
  const add = (id: string, q: Prisma.Decimal) => need.set(id, (need.get(id) ?? D(0)).plus(q));
  for (const it of items) {
    if (it.mix) {
      const m = await resolveMix(db, it.mix);
      for (const pt of m.portions) add(pt.ingredientId, D(pt.qty).times(it.quantity));
      if (m.size.cupIngredientId) add(m.size.cupIngredientId, D(it.quantity));
      continue;
    }
    for (const n of it.mixNeeds ?? []) add(n.ingredientId, D(n.qty).times(it.quantity));
    const chosen = [...new Set(it.optionIds)].map((id) => om.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
    const recipe = pm.get(it.productId)?.recipe;
    // у размера своя граммовка: берём её, коэффициент не нужен
    const bySize = pickSizeRows(recipe?.sizeItems ?? [], chosen.map((o) => o.id));
    if (bySize) for (const ri of bySize) add(ri.ingredientId, ri.quantity.times(it.quantity));
    else {
      const mult = chosen.reduce((m, o) => m.times(o.recipeMultiplier), D(1));
      for (const ri of recipe?.items ?? []) add(ri.ingredientId, ri.quantity.times(mult).times(it.quantity));
    }
    for (const o of chosen) if (o.extraIngredientId && o.extraQty) add(o.extraIngredientId, o.extraQty.times(it.quantity));
  }
  return need;
}

/**
 * Из нетто (что попадёт в стакан) в брутто (что взять со склада): делим на выход ингредиента.
 * Из 1000 г апельсина выходит 450 мл сока (выход 45%): на 225 мл сока уйдёт 500 г.
 */
export async function applyYield(db: Db, need: Map<string, Prisma.Decimal>) {
  if (!need.size) return need;
  const rows = await db.ingredient.findMany({ where: { id: { in: [...need.keys()] } }, select: { id: true, yieldPct: true } });
  const out = new Map(need);
  for (const r of rows) {
    const net = need.get(r.id);
    if (net && r.yieldPct.gt(0) && r.yieldPct.lt(100)) out.set(r.id, net.times(100).div(r.yieldPct).toDecimalPlaces(3));
  }
  return out;
}

export async function assertInStock(db: Db, locationId: string, items: CartItem[]) {
  const [net, stock] = await Promise.all([computeNeeds(db, items), usableStock(db, locationId)]);
  const need = await applyYield(db, net);
  const short = [...need].filter(([id, q]) => (stock.get(id) ?? D(0)).lt(q)).map(([id]) => id);
  if (!short.length) return;
  const ings = await db.ingredient.findMany({ where: { id: { in: short } }, select: { name: true } });
  throw new ApiError(400, `Не хватает ингредиентов: ${ings.map((i) => i.name).join(", ")}. Уберите позицию или пополните склад.`);
}

/**
 * Сайт: продукт без рецепта «Скоро будет доступно», заказать его нельзя (даже если обойти кнопку).
 * Настройка site.requireRecipe (по умолчанию включена). POS и официант этой проверкой не затронуты. «Свой микс» состав несёт сам.
 */
export async function assertSellableOnSite(db: Db, items: CartItem[]) {
  const row = await db.setting.findUnique({ where: { key: "site.requireRecipe" } });
  if (typeof row?.value === "number" && row.value === 0) return;
  const ids = [...new Set(items.filter((i) => !i.mix && !i.mixNeeds).map((i) => i.productId))];
  if (!ids.length) return;
  const rows = await db.product.findMany({ where: { id: { in: ids } }, select: { name: true, recipe: { select: { _count: { select: { items: true } } } } } });
  const soon = rows.filter((p) => !p.recipe || p.recipe._count.items === 0).map((p) => p.name);
  if (soon.length) throw new ApiError(400, `Скоро будет доступно: ${soon.join(", ")}. Уберите позицию из корзины.`);
}
