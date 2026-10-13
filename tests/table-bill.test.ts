import { describe, it, expect } from "vitest";
import { billTotal, closeBlockers, tableNote } from "@/lib/table-bill";
import { isTableToken, newTableToken } from "@/lib/tables";

const o = (number: number, status: string, total: number) => ({ number, status, total });

describe("счёт стола", () => {
  it("итог не включает отменённые заказы и округляется до копеек", () => {
    expect(billTotal([o(1, "COMPLETED", 30000), o(2, "CANCELLED", 99999), o(3, "READY", 12000.555)])).toBe(42000.56);
    expect(billTotal([])).toBe(0);
  });
  it("счёт нельзя закрыть, пока заказ в работе", () => {
    expect(closeBlockers([o(1, "READY", 1), o(2, "NEW", 1), o(3, "PREPARING", 1), o(4, "CONFIRMED", 1)])).toEqual([2, 3, 4]);
    expect(closeBlockers([o(1, "READY", 1), o(2, "COMPLETED", 1), o(3, "CANCELLED", 1)])).toEqual([]);
  });
  it("подпись гостя и комментарий склеиваются и обрезаются", () => {
    expect(tableNote("Алия", "без льда")).toBe("Гость: Алия. без льда");
    expect(tableNote(undefined, "  ")).toBeNull();
    expect(tableNote("  ", "сахар поменьше")).toBe("сахар поменьше");
    expect(tableNote("A", "x".repeat(400))!.length).toBe(300);
  });
});

describe("токен стола", () => {
  it("новый токен — 32 hex-символа и каждый раз другой", () => {
    const a = newTableToken(), b = newTableToken();
    expect(isTableToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });
  it("мусор токеном не считается", () => {
    for (const bad of ["", "abc", "g".repeat(32), "A".repeat(32), null, undefined, 123]) expect(isTableToken(bad)).toBe(false);
  });
});

import { allocate, feeOf, tipByPct, payQuote, unpaidOrders } from "@/lib/table-bill";

describe("сервисный сбор и чаевые", () => {
  it("сбор в целых суммах; 0% и пустая сумма дают 0", () => {
    expect(feeOf(100000, 10)).toBe(10000);
    expect(feeOf(33333, 10)).toBe(3333);
    expect(feeOf(100000, 0)).toBe(0);
    expect(feeOf(0, 10)).toBe(0);
  });
  it("чаевые в процентах от суммы к оплате", () => {
    expect(tipByPct(110000, 10)).toBe(11000);
    expect(tipByPct(110000, 0)).toBe(0);
  });
  it("итог к оплате: сумма + сбор, чаевые сверх", () => {
    expect(payQuote(100000, 10, 5000)).toEqual({ subtotal: 100000, fee: 10000, total: 110000, tip: 5000, collect: 115000 });
    expect(payQuote(100000, 0, -5).tip).toBe(0);
  });
});

describe("разделение суммы между заказами", () => {
  const sumOf = (a: number[]) => Math.round(a.reduce((s, x) => s + x, 0) * 100) / 100;
  it("части дают ровно исходную сумму", () => {
    for (const [t, w] of [[100, [1, 1, 1]], [3333, [30000, 50000, 20000]], [1, [1, 1]], [10000, [32000]], [7, [5, 3, 2, 9]]] as [number, number[]][]) {
      expect(sumOf(allocate(t, w))).toBe(t);
    }
  });
  it("пропорционально весам", () => {
    expect(allocate(1000, [30000, 70000])).toEqual([300, 700]);
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });
  it("дробная сумма делится на копейки", () => {
    expect(sumOf(allocate(10.01, [1, 1, 1]))).toBe(10.01);
  });
  it("нулевая сумма и нулевые веса", () => {
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
    expect(allocate(100, [0, 0])).toEqual([0, 0]);
    expect(allocate(100, [])).toEqual([]);
  });
});

describe("неоплаченные заказы", () => {
  it("не включает отменённые и уже оплаченные", () => {
    const o = [
      { number: 1, status: "COMPLETED", total: 10, paid: true }, { number: 2, status: "READY", total: 20, paid: false },
      { number: 3, status: "CANCELLED", total: 30, paid: false }, { number: 4, status: "NEW", total: 40, paid: false },
    ];
    expect(unpaidOrders(o).map((x) => x.number)).toEqual([2, 4]);
  });
});
