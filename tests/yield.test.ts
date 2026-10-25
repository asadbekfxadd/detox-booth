import { describe, it, expect } from "vitest";
import { grossQty, netUnitCost, normYield, lossPctOf } from "@/lib/yield";

describe("брутто и нетто", () => {
  it("1000 г апельсина → 450 мл сока: на 225 мл сока нужно 500 г", () => {
    expect(grossQty(225, 45)).toBeCloseTo(500, 6);
  });
  it("без потерь ничего не меняется", () => {
    expect(grossQty(30, 100)).toBe(30);
    expect(netUnitCost(12, 100)).toBe(12);
  });
  it("годный грамм дороже закупленного: цена 10 при выходе 50% → 20", () => {
    expect(netUnitCost(10, 50)).toBe(20);
  });
  it("мусор и ноль считаются как 100, делить на ноль нельзя", () => {
    for (const v of [0, -5, NaN, "", null, undefined, "abc"]) expect(normYield(v)).toBe(100);
    expect(grossQty(10, 0)).toBe(10);
  });
  it("больше 100 обрезаем до 100, меньше 1 поднимаем до 1", () => {
    expect(normYield(150)).toBe(100);
    expect(normYield(0.3)).toBe(1);
  });
  it("потери = 100 − выход", () => {
    expect(lossPctOf(45)).toBe(55);
    expect(lossPctOf(100)).toBe(0);
  });
});
