/**
 * Отчёт по сотрудникам: кто сколько продал. Чистая арифметика над списком заказов, без базы.
 * Продажа засчитывается тому, кто принял заказ: кассиру (cashierId) и официанту (waiterId). Заказ официанта,
 * закрытый на кассе, виден обоим, у каждого со своей ролью. Заказы с сайта без сотрудника попадают в строку «Без сотрудника».
 */
export type StaffOrder = {
  cashierId: string | null; waiterId: string | null;
  status: string; total: number; discount: number; serviceFee: number;
  payments: { status: string; amount: number; tip: number }[];
};

export type StaffRole = "cashier" | "waiter";
export type StaffRow = {
  key: string; userId: string | null; role: StaffRole | "none";
  orders: number; revenue: number; avgCheck: number; discount: number; discountPct: number;
  cancelled: number; refunded: number; refundedSum: number; tips: number;
};

const blank = (key: string, userId: string | null, role: StaffRow["role"]): StaffRow => ({ key, userId, role, orders: 0, revenue: 0, avgCheck: 0, discount: 0, discountPct: 0, cancelled: 0, refunded: 0, refundedSum: 0, tips: 0 });

export function buildStaffReport(orders: StaffOrder[]): StaffRow[] {
  const rows = new Map<string, StaffRow>();
  const get = (userId: string | null, role: StaffRow["role"]) => {
    const key = userId ? `${role}:${userId}` : "none";
    let r = rows.get(key); if (!r) { r = blank(key, userId, userId ? role : "none"); rows.set(key, r); }
    return r;
  };
  for (const o of orders) {
    const owners: StaffRow[] = [];
    if (o.cashierId) owners.push(get(o.cashierId, "cashier"));
    if (o.waiterId) owners.push(get(o.waiterId, "waiter"));
    if (owners.length === 0) owners.push(get(null, "none"));
    const refundedSum = o.payments.filter((p) => p.status === "REFUNDED").reduce((a, p) => a + p.amount, 0);
    for (const r of owners) {
      if (o.status === "COMPLETED") {
        r.orders++; r.revenue += o.total; r.discount += o.discount;
        r.tips += o.payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.tip, 0);
      } else if (o.status === "CANCELLED") {
        r.cancelled++;
        if (refundedSum > 0) { r.refunded++; r.refundedSum += refundedSum; }
      }
    }
  }
  const out = [...rows.values()];
  for (const r of out) {
    r.avgCheck = r.orders > 0 ? r.revenue / r.orders : 0;
    // скидка в % от суммы до скидки (выручка + скидка)
    r.discountPct = r.revenue + r.discount > 0 ? (r.discount / (r.revenue + r.discount)) * 100 : 0;
  }
  return out.sort((a, b) => b.revenue - a.revenue);
}
