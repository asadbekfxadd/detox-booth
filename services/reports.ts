import { prisma } from "@/lib/prisma";
import { buildStaffReport, type StaffRow } from "@/lib/staff-report";
import { abcClasses, weeklyStats, weekIndex, xyzClass, MIN_SALES_FOR_XYZ, type XYZ } from "@/lib/xyz";
import { startOfDay, type Range } from "@/services/dashboard";

const DAY = 86400000;
const n = (v: unknown) => Number(v ?? 0);

export type StaffReportRow = StaffRow & { name: string };

/** Продажи по кассирам и официантам за период. Заказы фильтруются по точке и дате создания. */
export async function getStaffReport(r: Range, locationId: string | null): Promise<StaffReportRow[]> {
  const orders = await prisma.order.findMany({
    where: { ...(locationId ? { locationId } : {}), status: { in: ["COMPLETED", "CANCELLED"] }, createdAt: { gte: r.from, lt: r.to } },
    select: { cashierId: true, waiterId: true, status: true, total: true, discount: true, serviceFee: true, payments: { select: { status: true, amount: true, tip: true } } },
  });
  const rows = buildStaffReport(orders.map((o) => ({
    cashierId: o.cashierId, waiterId: o.waiterId, status: o.status, total: n(o.total), discount: n(o.discount), serviceFee: n(o.serviceFee),
    payments: o.payments.map((p) => ({ status: p.status, amount: n(p.amount), tip: n(p.tip) })),
  })));
  const ids = [...new Set(rows.map((x) => x.userId).filter((x): x is string => !!x))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((x) => ({ ...x, name: x.userId ? names.get(x.userId) ?? "Удалённый сотрудник" : "Без сотрудника (сайт, киоск)" }));
}

export type MenuReportRow = {
  id: string; name: string; category: string; qty: number; revenue: number; share: number;
  abc: "A" | "B" | "C"; xyz: XYZ | null; cv: number | null; lowData: boolean;
};
export type UnsoldRow = { id: string; name: string; category: string; price: number; lastSoldAt: Date | null; daysSince: number | null; available: boolean };

/** Неделя-ведро для XYZ: окно из WEEKS полных недель, заканчивающееся сегодня */
export const XYZ_WEEKS = 12;

/**
 * ABC×XYZ по меню за последние 12 недель (не зависит от выбранного периода: стабильность спроса нельзя оценить по трём дням)
 * и список непродаваемых блюд: активные продукты без единой продажи за `unsoldDays` дней.
 */
export async function getMenuReport(locationId: string | null, unsoldDays: number) {
  const now = Date.now();
  const end = startOfDay(now) + DAY;
  const start = end - XYZ_WEEKS * 7 * DAY;
  const loc = locationId ? { locationId } : {};
  const [items, products] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { ...loc, status: "COMPLETED", createdAt: { gte: new Date(start), lt: new Date(end) } } },
      select: { productId: true, quantity: true, unitPrice: true, order: { select: { createdAt: true } } },
    }),
    prisma.product.findMany({ where: { isArchived: false }, select: { id: true, name: true, price: true, isAvailable: true, createdAt: true, category: { select: { name: true } } } }),
  ]);

  const per = new Map<string, { qty: number; revenue: number; weeks: number[] }>();
  for (const it of items) {
    const w = weekIndex(it.order.createdAt.getTime(), start, XYZ_WEEKS);
    if (w == null) continue;
    let p = per.get(it.productId); if (!p) { p = { qty: 0, revenue: 0, weeks: new Array(XYZ_WEEKS).fill(0) }; per.set(it.productId, p); }
    p.qty += it.quantity; p.revenue += it.quantity * n(it.unitPrice); p.weeks[w] += it.quantity;
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  const abc = abcClasses([...per.entries()].map(([id, p]) => ({ id, value: p.revenue })));
  const totalRev = [...per.values()].reduce((a, p) => a + p.revenue, 0);
  const menu: MenuReportRow[] = [...per.entries()].map(([id, p]) => {
    const { cv } = weeklyStats(p.weeks);
    return {
      id, name: byId.get(id)?.name ?? "Удалён", category: byId.get(id)?.category.name ?? "", qty: p.qty, revenue: p.revenue,
      share: totalRev > 0 ? (p.revenue / totalRev) * 100 : 0, abc: abc.get(id) ?? "C",
      xyz: xyzClass(cv), cv, lowData: p.qty < MIN_SALES_FOR_XYZ,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // непродаваемые: последняя продажа раньше границы или её не было вовсе (и блюдо старше границы)
  const cutoff = now - unsoldDays * DAY;
  const lastRows = await prisma.orderItem.findMany({
    where: { order: { ...loc, status: "COMPLETED" } },
    orderBy: { order: { createdAt: "desc" } }, distinct: ["productId"],
    select: { productId: true, order: { select: { createdAt: true } } },
  });
  const last = new Map(lastRows.map((x) => [x.productId, x.order.createdAt]));
  const unsold: UnsoldRow[] = products
    .filter((p) => p.createdAt.getTime() < cutoff)
    .map((p) => ({ p, at: last.get(p.id) ?? null }))
    .filter(({ at }) => !at || at.getTime() < cutoff)
    .map(({ p, at }) => ({ id: p.id, name: p.name, category: p.category.name, price: n(p.price), lastSoldAt: at, daysSince: at ? Math.floor((now - at.getTime()) / DAY) : null, available: p.isAvailable }))
    .sort((a, b) => (b.daysSince ?? 1e9) - (a.daysSince ?? 1e9));
  return { menu, unsold, weeks: XYZ_WEEKS, from: new Date(start), to: new Date(end) };
}
