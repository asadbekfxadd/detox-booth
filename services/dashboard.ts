import { prisma } from "@/lib/prisma";

const TZ = 5 * 3600000; // Ташкент UTC+5
const DAY = 86400000;
export const startOfDay = (t: number) => Math.floor((t + TZ) / DAY) * DAY - TZ;

export type Range = { key: "today" | "7" | "30" | "custom"; from: Date; to: Date };

export function parseRange(sp: { range?: string; from?: string; to?: string }): Range {
  const today = startOfDay(Date.now());
  if (sp.range === "today") return { key: "today", from: new Date(today), to: new Date(today + DAY) };
  if (sp.range === "30") return { key: "30", from: new Date(today - 29 * DAY), to: new Date(today + DAY) };
  if (sp.range === "custom" && sp.from && sp.to) {
    const f = Date.parse(sp.from), t = Date.parse(sp.to);
    if (!isNaN(f) && !isNaN(t) && f <= t && t - f <= 366 * DAY)
      return { key: "custom", from: new Date(f - TZ), to: new Date(t - TZ + DAY) };
  }
  return { key: "7", from: new Date(today - 6 * DAY), to: new Date(today + DAY) };
}

export async function getDashboard(r: Range, locationId: string | null) {
  const loc = locationId ? { locationId } : {};
  const now = new Date();
  const [orders, wo, newCust, stocks, batches, notes, locs] = await Promise.all([
    prisma.order.findMany({
      where: { ...loc, status: "COMPLETED", createdAt: { gte: r.from, lt: r.to } },
      select: {
        locationId: true, total: true, cogs: true, customerId: true, createdAt: true,
        items: { select: { quantity: true, unitPrice: true, product: { select: { name: true, category: { select: { name: true } } } } } },
      },
    }),
    prisma.writeOff.aggregate({ where: { ...loc, createdAt: { gte: r.from, lt: r.to } }, _sum: { cost: true } }),
    prisma.customer.findMany({ where: { createdAt: { gte: r.from, lt: r.to } }, select: { id: true } }),
    prisma.stockItem.findMany({ where: loc, include: { ingredient: true, location: true } }),
    prisma.batch.findMany({
      where: { ...loc, quantity: { gt: 0 }, expiresAt: { not: null, lt: new Date(now.getTime() + 3 * DAY) } },
      include: { ingredient: true },
    }),
    prisma.notification.findMany({
      where: locationId ? { OR: [{ locationId }, { locationId: null }] } : {},
      orderBy: { createdAt: "desc" }, take: 6,
    }),
    prisma.location.findMany({ select: { id: true, name: true } }),
  ]);

  const revenue = orders.reduce((a, o) => a + Number(o.total), 0);
  const cogs = orders.reduce((a, o) => a + Number(o.cogs), 0);
  const profit = revenue - cogs;

  const days = new Map<number, { revenue: number; profit: number; orders: number }>();
  for (let d = startOfDay(r.from.getTime() + 1); d < r.to.getTime(); d += DAY) days.set(d, { revenue: 0, profit: 0, orders: 0 });
  const cats = new Map<string, number>();
  const prods = new Map<string, { qty: number; revenue: number }>();
  const byLoc = new Map<string, { revenue: number; orders: number }>();
  const buyers = new Set<string>();

  for (const o of orders) {
    const t = Number(o.total), c = Number(o.cogs);
    const day = days.get(startOfDay(o.createdAt.getTime()));
    if (day) { day.revenue += t; day.profit += t - c; day.orders += 1; }
    const l = byLoc.get(o.locationId) ?? { revenue: 0, orders: 0 };
    l.revenue += t; l.orders += 1; byLoc.set(o.locationId, l);
    if (o.customerId) buyers.add(o.customerId);
    for (const it of o.items) {
      const sum = Number(it.unitPrice) * it.quantity;
      const cn = it.product.category.name;
      cats.set(cn, (cats.get(cn) ?? 0) + sum);
      const p = prods.get(it.product.name) ?? { qty: 0, revenue: 0 };
      p.qty += it.quantity; p.revenue += sum; prods.set(it.product.name, p);
    }
  }
  const newSet = new Set(newCust.map((c) => c.id));
  const returning = [...buyers].filter((id) => !newSet.has(id)).length;

  return {
    revenue, orders: orders.length, avgCheck: orders.length ? revenue / orders.length : 0,
    profit, margin: revenue ? (profit / revenue) * 100 : 0, foodCost: revenue ? (cogs / revenue) * 100 : 0,
    writeOffs: Number(wo._sum.cost ?? 0), newCustomers: newSet.size, returningCustomers: returning,
    byDay: [...days.entries()].map(([d, v]) => ({ label: new Date(d + TZ).toISOString().slice(5, 10), ...v })),
    byCategory: [...cats.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue),
    topProducts: [...prods.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    lowStock: stocks
      .filter((s) => s.quantity.lt(s.ingredient.minStock))
      .map((s) => ({ name: s.ingredient.name, location: s.location.name, qty: Number(s.quantity), min: Number(s.ingredient.minStock), unit: s.ingredient.unit })),
    expired: batches.filter((b) => b.expiresAt! < now).length,
    expiringSoon: batches.filter((b) => b.expiresAt! >= now).length,
    byLocation: locationId ? [] : locs.map((l) => ({ name: l.name, ...(byLoc.get(l.id) ?? { revenue: 0, orders: 0 }) })),
    notifications: notes.map((n) => ({ id: n.id, type: n.type, message: n.message, createdAt: n.createdAt.toISOString() })),
  };
}
