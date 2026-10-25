import { describe, it, expect } from "vitest";
import { buildStaffReport, type StaffOrder } from "@/lib/staff-report";
import { weeklyStats, xyzClass, abcClasses, weekIndex } from "@/lib/xyz";

const o = (p: Partial<StaffOrder>): StaffOrder => ({ cashierId: null, waiterId: null, status: "COMPLETED", total: 10000, discount: 0, serviceFee: 0, payments: [{ status: "PAID", amount: 10000, tip: 0 }], ...p });

describe("отчёт по сотрудникам", () => {
  it("считает заказы, выручку и средний чек кассира", () => {
    const r = buildStaffReport([o({ cashierId: "c1", total: 10000 }), o({ cashierId: "c1", total: 20000 }), o({ cashierId: "c2", total: 5000 })]);
    const c1 = r.find((x) => x.key === "cashier:c1")!;
    expect(c1.orders).toBe(2); expect(c1.revenue).toBe(30000); expect(c1.avgCheck).toBe(15000);
    expect(r[0].key).toBe("cashier:c1"); // сортировка по выручке
  });
  it("заказ официанта, пробитый на кассе, виден обоим, каждому со своей ролью", () => {
    const r = buildStaffReport([o({ cashierId: "c1", waiterId: "w1", total: 40000 })]);
    expect(r.map((x) => x.key).sort()).toEqual(["cashier:c1", "waiter:w1"]);
    expect(r.every((x) => x.revenue === 40000)).toBe(true);
  });
  it("заказ без сотрудника (сайт) — отдельная строка", () => {
    const r = buildStaffReport([o({})]);
    expect(r).toHaveLength(1); expect(r[0].role).toBe("none");
  });
  it("скидки в процентах от суммы до скидки, чаевые только с оплаченного", () => {
    const r = buildStaffReport([o({ cashierId: "c1", total: 9000, discount: 1000, payments: [{ status: "PAID", amount: 9000, tip: 500 }] })])[0];
    expect(r.discountPct).toBe(10);
    expect(r.tips).toBe(500);
  });
  it("отмены и возвраты считаются отдельно и не входят в выручку", () => {
    const r = buildStaffReport([
      o({ cashierId: "c1", total: 10000 }),
      o({ cashierId: "c1", status: "CANCELLED", total: 7000, payments: [{ status: "REFUNDED", amount: 7000, tip: 0 }] }),
      o({ cashierId: "c1", status: "CANCELLED", total: 3000, payments: [{ status: "FAILED", amount: 3000, tip: 0 }] }),
    ])[0];
    expect(r.revenue).toBe(10000); expect(r.orders).toBe(1);
    expect(r.cancelled).toBe(2); expect(r.refunded).toBe(1); expect(r.refundedSum).toBe(7000);
  });
});

describe("XYZ и ABC", () => {
  it("ровные продажи — X, скачущие — Z", () => {
    expect(xyzClass(weeklyStats([20, 21, 19, 20, 20, 21]).cv)).toBe("X");
    expect(xyzClass(weeklyStats([5, 40, 0, 60, 2, 30]).cv)).toBe("Z");
    expect(xyzClass(weeklyStats([20, 28, 15, 24, 18, 26]).cv)).toBe("Y");
  });
  it("нет продаж — класса нет, а не деление на ноль", () => {
    expect(weeklyStats([0, 0, 0]).cv).toBeNull();
    expect(xyzClass(null)).toBeNull();
    expect(weeklyStats([]).mean).toBe(0);
  });
  it("ABC: блюдо, перешагнувшее 80%, остаётся в A; после 95% — C; нулевые — C", () => {
    const m = abcClasses([{ id: "a", value: 800 }, { id: "b", value: 100 }, { id: "c", value: 60 }, { id: "d", value: 40 }, { id: "z", value: 0 }]);
    expect(m.get("a")).toBe("A"); expect(m.get("b")).toBe("B"); expect(m.get("c")).toBe("B"); expect(m.get("d")).toBe("C"); expect(m.get("z")).toBe("C");
  });
  it("номер недели в окне", () => {
    const start = Date.UTC(2026, 9, 5);
    expect(weekIndex(start + 3 * 86400000, start, 12)).toBe(0);
    expect(weekIndex(start + 8 * 86400000, start, 12)).toBe(1);
    expect(weekIndex(start - 1, start, 12)).toBeNull();
    expect(weekIndex(start + 12 * 7 * 86400000, start, 12)).toBeNull();
  });
});
