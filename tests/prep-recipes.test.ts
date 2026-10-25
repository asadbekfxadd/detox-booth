import { describe, it, expect } from "vitest";
import { scalePrepItems, prepUnitCost, makesCycle } from "@/lib/prep";
import { buildRow, isEmptyRow, periodBounds } from "@/lib/turnover";

describe("заготовки", () => {
  const items = [{ ingredientId: "orange", quantity: 11000 }, { ingredientId: "ginger", quantity: 100 }];
  it("из 5 л готовим 2 л: сырья в 2,5 раза меньше", () => {
    const s = scalePrepItems(items, 5000, 2000);
    expect(s[0].quantity).toBe(4400);
    expect(s[1].quantity).toBe(40);
  });
  it("тот же объём — те же граммы; 0 или мусор — нули, а не NaN", () => {
    expect(scalePrepItems(items, 5000, 5000).map((i) => i.quantity)).toEqual([11000, 100]);
    expect(scalePrepItems(items, 0, 100).map((i) => i.quantity)).toEqual([0, 0]);
    expect(scalePrepItems(items, 5000, NaN).map((i) => i.quantity)).toEqual([0, 0]);
  });
  it("себестоимость единицы = сырьё ÷ фактический выход", () => {
    expect(prepUnitCost(132_000, 5000)).toBeCloseTo(26.4, 6);
    expect(prepUnitCost(132_000, 4400)).toBe(30); // получилось меньше — дороже
    expect(prepUnitCost(100, 0)).toBe(0);
  });
  it("круг заготовок находится: А из Б, Б из А", () => {
    const g = new Map([["syrup", ["sugar"]], ["mix", ["syrup", "water"]]]);
    expect(makesCycle(g, "syrup", ["mix"])).toBe(true); // сироп из микса, а микс из сиропа
    expect(makesCycle(g, "mix", ["syrup", "ice"])).toBe(false);
    expect(makesCycle(g, "x", ["x"])).toBe(true);
    expect(makesCycle(new Map(), "a", ["b"])).toBe(false);
  });
});

describe("оборотная ведомость", () => {
  it("конец и начало считаются от текущего остатка назад", () => {
    // сейчас на складе 70; после периода продали 10 и приняли 5; за период принято 100, продано 30, списано 5
    const r = buildRow(70, { PURCHASE: 100, SALE: -30, WRITE_OFF: -5 }, { SALE: -10, PURCHASE: 5 });
    expect(r.closing).toBe(75);      // 70 − (−10 + 5)
    expect(r.opening).toBe(10);      // 75 − (100 − 30 − 5)
    expect(r.receipts).toBe(100); expect(r.sales).toBe(30); expect(r.writeOffs).toBe(5);
    expect(r.opening + r.receipts - r.sales - r.writeOffs).toBe(r.closing);
  });
  it("баланс сходится со всеми видами движения", () => {
    const r = buildRow(500, { PURCHASE: 1000, TRANSFER_IN: 200, PRODUCTION_IN: 300, SALE: -400, WRITE_OFF: -50, PRODUCTION_OUT: -250, TRANSFER_OUT: -100, COUNT: -20, ADJUSTMENT: 10 }, {});
    expect(r.closing).toBe(500);
    expect(r.opening + r.receipts + r.prodIn - r.sales - r.writeOffs - r.prodOut - r.transferOut + r.adjust).toBeCloseTo(r.closing, 6);
  });
  it("пустая строка скрывается, строка с остатком нет", () => {
    expect(isEmptyRow(buildRow(0, {}, {}))).toBe(true);
    expect(isEmptyRow(buildRow(5, {}, {}))).toBe(false);
  });
  it("период по Ташкенту: конец включительно, суток нужное число", () => {
    const b = periodBounds("2026-10-01", "2026-10-01")!;
    expect(b.to.getTime() - b.from.getTime()).toBe(86400000);
    expect(b.from.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(periodBounds("2026-10-02", "2026-10-01")).toBeNull();
    expect(periodBounds("мусор", "2026-10-01")).toBeNull();
  });
});
