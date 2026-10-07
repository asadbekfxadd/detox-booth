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
