import { prisma } from "@/lib/prisma";
import { startOfDay, type Range } from "@/services/dashboard";

const TZ = 5 * 3600000;
const DAY = 86400000;

export async function getSales(r: Range, locationId: string | null) {
  const loc = locationId ? { locationId } : {};
  const orders = await prisma.order.findMany({
    where: { ...loc, status: "COMPLETED", createdAt: { gte: r.from, lt: r.to } },
    select: {
      total: true, discount: true, createdAt: true, source: true,
      items: { select: { quantity: true, unitPrice: true, product: { select: { name: true, category: { select: { name: true } } } } } },
    },
  });
  const days = new Map<number, { orders: number; revenue: number; discount: number }>();
  for (let d = startOfDay(r.from.getTime() + 1); d < r.to.getTime(); d += DAY) days.set(d, { orders: 0, revenue: 0, discount: 0 });
  const prods = new Map<string, { category: string; qty: number; revenue: number }>();
  const src = { POS: { orders: 0, revenue: 0 }, WEB: { orders: 0, revenue: 0 } };
  for (const o of orders) {
    const x = days.get(startOfDay(o.createdAt.getTime()));
    if (x) { x.orders++; x.revenue += Number(o.total); x.discount += Number(o.discount); }
    src[o.source].orders++; src[o.source].revenue += Number(o.total);
    for (const it of o.items) {
      const p = prods.get(it.product.name) ?? { category: it.product.category.name, qty: 0, revenue: 0 };
      p.qty += it.quantity; p.revenue += Number(it.unitPrice) * it.quantity; prods.set(it.product.name, p);
    }
  }
  const revenue = orders.reduce((a, o) => a + Number(o.total), 0);
  const itemsRevenue = [...prods.values()].reduce((a, p) => a + p.revenue, 0);
  return {
    orders: orders.length, revenue, avgCheck: orders.length ? revenue / orders.length : 0, discount: orders.reduce((a, o) => a + Number(o.discount), 0),
    byDay: [...days.entries()].map(([d, v]) => ({ date: new Date(d + TZ).toISOString().slice(0, 10), ...v, avg: v.orders ? v.revenue / v.orders : 0 })).reverse(),
    products: [...prods.entries()].map(([name, p]) => ({ name, ...p, share: itemsRevenue ? (p.revenue / itemsRevenue) * 100 : 0 })).sort((a, b) => b.revenue - a.revenue),
    sources: src,
  };
}
