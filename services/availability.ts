import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";

type Db = Prisma.TransactionClient;
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
export type CartItem = { productId: string; quantity: number; optionIds: string[] };

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
    include: { recipe: { include: { items: true } } },
  });
  const pm = new Map(products.map((p) => [p.id, p]));
  const optionIds = [...new Set(items.flatMap((i) => i.optionIds))];
  const opts = optionIds.length ? await db.modifierOption.findMany({ where: { id: { in: optionIds } } }) : [];
  const om = new Map(opts.map((o) => [o.id, o]));
  const need = new Map<string, Prisma.Decimal>();
  const add = (id: string, q: Prisma.Decimal) => need.set(id, (need.get(id) ?? D(0)).plus(q));
  for (const it of items) {
    const chosen = [...new Set(it.optionIds)].map((id) => om.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
    const mult = chosen.reduce((m, o) => m.times(o.recipeMultiplier), D(1));
    for (const ri of pm.get(it.productId)?.recipe?.items ?? []) add(ri.ingredientId, ri.quantity.times(mult).times(it.quantity));
    for (const o of chosen) if (o.extraIngredientId && o.extraQty) add(o.extraIngredientId, o.extraQty.times(it.quantity));
  }
  return need;
}

export async function assertInStock(db: Db, locationId: string, items: CartItem[]) {
  const [need, stock] = await Promise.all([computeNeeds(db, items), usableStock(db, locationId)]);
  const short = [...need].filter(([id, q]) => (stock.get(id) ?? D(0)).lt(q)).map(([id]) => id);
  if (!short.length) return;
  const ings = await db.ingredient.findMany({ where: { id: { in: short } }, select: { name: true } });
  throw new ApiError(400, `Не хватает ингредиентов: ${ings.map((i) => i.name).join(", ")}. Уберите позицию или пополните склад.`);
}
