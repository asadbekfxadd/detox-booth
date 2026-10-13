import { describe, expect, it } from "vitest";
import { activeRule, discounted, hhmm, parseHhmm, priceAt, tashkentClock, type HappyRule } from "@/lib/happy-hour";
import { happySchema } from "@/services/happy-hour";
import { ROUTE_PERMISSIONS } from "@/lib/rbac";

// 2026-10-13 — вторник. 12:00 UTC = 17:00 в Ташкенте.
const tue17 = Date.UTC(2026, 9, 13, 12, 0);
const base: HappyRule = { percent: 20, days: [1, 2, 3, 4, 5], startMin: 15 * 60, endMin: 18 * 60, categoryId: null };

describe("счастливые часы", () => {
  it("считает день и время по Ташкенту", () => {
    expect(tashkentClock(tue17)).toEqual({ dow: 2, min: 17 * 60 });
    // воскресенье 22:00 UTC = понедельник 03:00 в Ташкенте
    expect(tashkentClock(Date.UTC(2026, 9, 11, 22, 0))).toEqual({ dow: 1, min: 3 * 60 });
    expect(tashkentClock(Date.UTC(2026, 9, 11, 12, 0)).dow).toBe(7);
  });
  it("границы: начало включено, конец нет", () => {
    expect(activeRule([base], "c", Date.UTC(2026, 9, 13, 10, 0))?.percent).toBe(20); // 15:00
    expect(activeRule([base], "c", Date.UTC(2026, 9, 13, 12, 59))?.percent).toBe(20); // 17:59
    expect(activeRule([base], "c", Date.UTC(2026, 9, 13, 13, 0))).toBeNull(); // 18:00
    expect(activeRule([base], "c", Date.UTC(2026, 9, 13, 9, 59))).toBeNull(); // 14:59
  });
  it("не действует в другие дни", () => {
    expect(activeRule([base], "c", Date.UTC(2026, 9, 17, 12, 0))).toBeNull(); // суббота
  });
  it("правило категории не трогает другие категории", () => {
    const r = { ...base, categoryId: "smoothies" };
    expect(activeRule([r], "smoothies", tue17)).not.toBeNull();
    expect(activeRule([r], "salads", tue17)).toBeNull();
  });
  it("из двух правил берёт большую скидку", () => {
    expect(activeRule([base, { ...base, percent: 35, categoryId: "c" }], "c", tue17)?.percent).toBe(35);
  });
  it("цена: скидка на базу, округление до суммы", () => {
    expect(discounted(58000, 20)).toBe(46400);
    expect(discounted(33333, 15)).toBe(28333);
    expect(priceAt([base], "c", 58000, tue17)).toMatchObject({ price: 46400, percent: 20 });
    expect(priceAt([base], "c", 58000, Date.UTC(2026, 9, 17, 12, 0))).toMatchObject({ price: 58000, percent: 0 });
  });
  it("время HH:MM", () => {
    expect(parseHhmm("16:30")).toBe(990);
    expect(parseHhmm("24:00")).toBe(1440);
    expect(parseHhmm("25:00")).toBeNull();
    expect(parseHhmm("abc")).toBeNull();
    expect(hhmm(990)).toBe("16:30");
  });
  it("форма: проверки", () => {
    const ok = { name: "Вечер", percent: "20", days: ["1", "2"], start: "15:00", end: "17:00" };
    expect(happySchema.parse(ok)).toMatchObject({ percent: 20, days: [1, 2], start: 900, end: 1020 });
    expect(() => happySchema.parse({ ...ok, end: "14:00" })).toThrow();
    expect(() => happySchema.parse({ ...ok, days: [] })).toThrow();
    expect(() => happySchema.parse({ ...ok, percent: "95" })).toThrow();
    expect(() => happySchema.parse({ ...ok, start: "9" })).toThrow();
  });
  it("страница только для settings.edit", () => {
    expect(ROUTE_PERMISSIONS.find(([p]) => p === "/admin/happy-hour")?.[1]).toBe("settings.edit");
  });
});
