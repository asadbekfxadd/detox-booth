import { prisma } from "@/lib/prisma";
import type { Range } from "@/services/dashboard";
import { REASON_LABEL } from "@/services/finance";

const TZ = 5 * 3600000;
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export type MenuClass = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";

export async function getAnalytics(r: Range, locationId: string | null) {
  const loc = locationId ? { locationId } : {};
  const range = { gte: r.from, lt: r.to };
  const [done, statusCounts, refunds, woReason, woIng, locs, newCust] = await Promise.all([
    prisma.order.findMany({
      where: { ...loc, status: "COMPLETED", createdAt: range },
      select: {
        locationId: true, customerId: true, total: true, cogs: true, discount: true, promoCode: true, source: true, fulfillment: true, createdAt: true,
        payments: { where: { status: "PAID" }, select: { method: true, amount: true } },
        items: { select: { productId: true, quantity: true, unitPrice: true, product: { select: { name: true, category: { select: { name: true } } } } } },
      },
    }),
    prisma.order.groupBy({ by: ["status"], where: { ...loc, createdAt: range }, _count: true }),
    prisma.payment.aggregate({ where: { status: "REFUNDED", order: { ...loc, createdAt: range } }, _sum: { amount: true }, _count: true }),
    prisma.writeOff.groupBy({ by: ["reason"], where: { ...loc, createdAt: range }, _sum: { cost: true }, _count: true, orderBy: { _sum: { cost: "desc" } } }),
    prisma.writeOff.groupBy({ by: ["ingredientId"], where: { ...loc, createdAt: range }, _sum: { cost: true }, orderBy: { _sum: { cost: "desc" } }, take: 5 }),
    prisma.location.findMany({ select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { createdAt: range }, select: { id: true } }),
  ]);

  // себестоимость рецептов (по текущей средней цене ингредиентов)
  const productIds = [...new Set(done.flatMap((o) => o.items.map((i) => i.productId)))];
  const recipes = productIds.length ? await prisma.recipeItem.findMany({
    where: { recipe: { productId: { in: productIds } } }, select: { quantity: true, recipe: { select: { productId: true } }, ingredient: { select: { avgCost: true } } },
  }) : [];
  const unitCost = new Map<string, number>();
  for (const ri of recipes) unitCost.set(ri.recipe.productId, (unitCost.get(ri.recipe.productId) ?? 0) + Number(ri.quantity) * Number(ri.ingredient.avgCost));

  const revenue = done.reduce((a, o) => a + Number(o.total), 0);
  const prods = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, "0")}:00`, orders: 0, revenue: 0 }));
  const wd = WEEK_ORDER.map((d) => ({ day: d, label: WEEKDAYS[d], orders: 0, revenue: 0 }));
  const channels = new Map<string, { label: string; orders: number; revenue: number }>();
  const pay: Record<string, number> = { CASH: 0, CARD: 0, ONLINE: 0 };
  const byLoc = new Map<string, { revenue: number; cogs: number; orders: number }>();
  const spend = new Map<string, { orders: number; spent: number }>();
  let promoOrders = 0, promoDiscount = 0, discountTotal = 0;

  for (const o of done) {
    const t = Number(o.total), shifted = new Date(o.createdAt.getTime() + TZ);
    const h = hours[shifted.getUTCHours()]; h.orders++; h.revenue += t;
    const w = wd.find((x) => x.day === shifted.getUTCDay())!; w.orders++; w.revenue += t;
    const ck = `${o.source}-${o.fulfillment}`;
    const lbl = o.source === "POS" ? "Касса" : o.source === "TABLE" ? "Столы (QR)" : o.fulfillment === "DELIVERY" ? "Сайт · доставка" : "Сайт · самовывоз";
    const c = channels.get(ck) ?? { label: lbl, orders: 0, revenue: 0 }; c.orders++; c.revenue += t; channels.set(ck, c);
    for (const p of o.payments) pay[p.method] += Number(p.amount);
    const l = byLoc.get(o.locationId) ?? { revenue: 0, cogs: 0, orders: 0 }; l.revenue += t; l.cogs += Number(o.cogs); l.orders++; byLoc.set(o.locationId, l);
    discountTotal += Number(o.discount);
    if (o.promoCode) { promoOrders++; promoDiscount += Number(o.discount); }
    if (o.customerId) { const s = spend.get(o.customerId) ?? { orders: 0, spent: 0 }; s.orders++; s.spent += t; spend.set(o.customerId, s); }
    for (const it of o.items) {
      const p = prods.get(it.productId) ?? { name: it.product.name, category: it.product.category.name, qty: 0, revenue: 0 };
      p.qty += it.quantity; p.revenue += Number(it.unitPrice) * it.quantity; prods.set(it.productId, p);
    }
  }

  // ABC по выручке
  const sorted = [...prods.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const itemsRevenue = sorted.reduce((a, [, p]) => a + p.revenue, 0);
  let cum = 0;
  const abc = sorted.map(([id, p]) => {
    const before = cum; cum += p.revenue;
    const cls = itemsRevenue === 0 ? "C" : before / itemsRevenue < 0.8 ? "A" : before / itemsRevenue < 0.95 ? "B" : "C";
    return { id, ...p, share: itemsRevenue ? (p.revenue / itemsRevenue) * 100 : 0, cum: itemsRevenue ? (cum / itemsRevenue) * 100 : 0, abc: cls };
  });

  // меню-инжиниринг: популярность × маржа на единицу (по рецепту)
  const costed = abc.filter((p) => unitCost.has(p.id) && p.qty > 0).map((p) => ({ ...p, avgPrice: p.revenue / p.qty, cost: unitCost.get(p.id)! }))
    .map((p) => ({ ...p, margin: p.avgPrice - p.cost, marginPct: p.avgPrice ? ((p.avgPrice - p.cost) / p.avgPrice) * 100 : 0 }));
  const popThreshold = costed.length ? (1 / costed.length) * 0.7 : 0;
  const costedQty = costed.reduce((a, p) => a + p.qty, 0);
  const avgMargin = costedQty ? costed.reduce((a, p) => a + p.margin * p.qty, 0) / costedQty : 0; // средняя маржа, взвешенная продажами
  const menu = costed.map((p) => {
    const popular = costedQty ? p.qty / costedQty >= popThreshold : false;
    const high = p.margin >= avgMargin;
    const cls: MenuClass = popular && high ? "STAR" : popular ? "PLOWHORSE" : high ? "PUZZLE" : "DOG";
    return { ...p, popular, cls };
  }).sort((a, b) => b.qty - a.qty);

  // клиенты
  const newSet = new Set(newCust.map((c) => c.id));
  const buyers = [...spend.keys()];
  const repeat = buyers.filter((id) => (spend.get(id)?.orders ?? 0) >= 2).length;
  const topIds = [...spend.entries()].sort((a, b) => b[1].spent - a[1].spent).slice(0, 8);
  const names = topIds.length ? await prisma.customer.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, name: true, phone: true } }) : [];
  const nm = new Map(names.map((n) => [n.id, n]));
  const ingNames = woIng.length ? await prisma.ingredient.findMany({ where: { id: { in: woIng.map((w) => w.ingredientId) } }, select: { id: true, name: true } }) : [];
  const ing = new Map(ingNames.map((i) => [i.id, i.name]));

  const sc = new Map(statusCounts.map((s) => [s.status, s._count]));
  const allOrders = [...sc.values()].reduce((a, b) => a + b, 0);
  const cancelled = sc.get("CANCELLED") ?? 0;

  return {
    revenue, orders: done.length, avgCheck: done.length ? revenue / done.length : 0,
    cancelled, cancelRate: allOrders ? (cancelled / allOrders) * 100 : 0, refunds: Number(refunds._sum.amount ?? 0), refundCount: refunds._count,
    hours: hours.filter((h) => h.orders > 0 || (Number(h.label.slice(0, 2)) >= 8 && Number(h.label.slice(0, 2)) <= 22)),
    weekdays: wd, channels: [...channels.values()].sort((a, b) => b.revenue - a.revenue), payments: pay,
    abc, menu, avgMargin,
    customers: { buyers: buyers.length, newBuyers: buyers.filter((id) => newSet.has(id)).length, returning: buyers.filter((id) => !newSet.has(id)).length, repeatRate: buyers.length ? (repeat / buyers.length) * 100 : 0,
      top: topIds.map(([id, s]) => ({ id, name: nm.get(id)?.name ?? "—", phone: nm.get(id)?.phone ?? "", ...s })) },
    promo: { orders: promoOrders, discount: promoDiscount, discountTotal, discountShare: revenue + discountTotal ? (discountTotal / (revenue + discountTotal)) * 100 : 0 },
    writeOffs: { byReason: woReason.map((w) => ({ reason: REASON_LABEL[w.reason], count: w._count, cost: Number(w._sum.cost ?? 0) })), topIngredients: woIng.map((w) => ({ name: ing.get(w.ingredientId) ?? "—", cost: Number(w._sum.cost ?? 0) })) },
    locations: locationId ? [] : locs.map((l) => { const v = byLoc.get(l.id) ?? { revenue: 0, cogs: 0, orders: 0 }; return { name: l.name, ...v, avgCheck: v.orders ? v.revenue / v.orders : 0, margin: v.revenue ? ((v.revenue - v.cogs) / v.revenue) * 100 : 0 }; }).sort((a, b) => b.revenue - a.revenue),
  };
}
