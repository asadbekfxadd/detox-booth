import { describe, it, expect } from "vitest";
import { isMonth, isDay, daysInMonth, shiftMonth, monthGrid, monthLast, dayStart, dayEnd, dayTitle, shortMoney } from "@/lib/revenue-calendar";
import { dailySalesSchema } from "@/services/revenue-calendar";
import { can } from "@/lib/rbac";

describe("календарь: даты", () => {
  it("проверка месяца и дня", () => {
    expect(isMonth("2026-10")).toBe(true); expect(isMonth("2026-13")).toBe(false); expect(isMonth("26-10")).toBe(false); expect(isMonth(undefined)).toBe(false);
    expect(isDay("2026-10-31")).toBe(true); expect(isDay("2026-02-30")).toBe(false); expect(isDay("2026-10-1")).toBe(false); expect(isDay("1999-01-01")).toBe(false);
  });
  it("дней в месяце, високосный год", () => {
    expect(daysInMonth("2026-10")).toBe(31); expect(daysInMonth("2026-02")).toBe(28); expect(daysInMonth("2028-02")).toBe(29);
    expect(monthLast("2026-04")).toBe("2026-04-30");
  });
  it("переход между месяцами и годами", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01"); expect(shiftMonth("2026-01", -1)).toBe("2025-12"); expect(shiftMonth("2026-10", 0)).toBe("2026-10");
  });
  it("сетка: неделя с понедельника, все дни на месте", () => {
    const g = monthGrid("2026-10"); // 1 октября 2026 — четверг
    expect(g[0].slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(monthGrid("2026-06")[0][0]).toBe("2026-06-01"); // понедельник
  });
  it("границы дня по Ташкенту (UTC+5)", () => {
    expect(dayStart("2026-10-15").toISOString()).toBe("2026-10-14T19:00:00.000Z");
    expect(dayEnd("2026-10-15").toISOString()).toBe("2026-10-15T19:00:00.000Z");
  });
  it("подпись дня", () => expect(dayTitle("2026-10-15")).toBe("15 октября 2026, четверг"));
  it("короткие суммы", () => {
    expect(shortMoney(0)).toBe("0"); expect(shortMoney(850)).toBe("850"); expect(shortMoney(10_000)).toBe("10 тыс"); expect(shortMoney(85_400)).toBe("85 тыс");
    expect(shortMoney(1_000_000)).toBe("1 млн"); expect(shortMoney(1_250_000)).toBe("1,25 млн"); expect(shortMoney(12_000_000)).toBe("12 млн");
  });
});

describe("внесение продаж: проверка формы", () => {
  const ok = { day: "2026-10-15", locationId: "l1", amount: "1500000" };
  it("минимум: дата, точка, сумма", () => expect(dailySalesSchema.safeParse(ok).success).toBe(true));
  it("сумма положительная", () => {
    expect(dailySalesSchema.safeParse({ ...ok, amount: "0" }).success).toBe(false);
    expect(dailySalesSchema.safeParse({ ...ok, amount: "-5" }).success).toBe(false);
    expect(dailySalesSchema.safeParse({ ...ok, amount: "abc" }).success).toBe(false);
  });
  it("плохая дата, нет точки", () => {
    expect(dailySalesSchema.safeParse({ ...ok, day: "2026-02-31" }).success).toBe(false);
    expect(dailySalesSchema.safeParse({ ...ok, locationId: "" }).success).toBe(false);
  });
  it("способ оплаты и число чеков необязательны, но проверяются", () => {
    expect(dailySalesSchema.safeParse({ ...ok, method: "", ordersCount: "", note: "" }).success).toBe(true);
    expect(dailySalesSchema.safeParse({ ...ok, method: "CRYPTO" }).success).toBe(false);
    expect(dailySalesSchema.safeParse({ ...ok, ordersCount: "2.5" }).success).toBe(false);
    expect(dailySalesSchema.safeParse({ ...ok, ordersCount: "40" }).data?.ordersCount).toBe(40);
  });
});

describe("календарь: права", () => {
  it("смотрят владелец, администратор, бухгалтер; вносят только владелец и бухгалтер", () => {
    for (const r of ["OWNER", "ADMIN", "ACCOUNTANT"] as const) expect(can(r, "finance.view")).toBe(true);
    expect(can("ADMIN", "finance.edit")).toBe(false);
    expect(can("CASHIER", "finance.view")).toBe(false);
    expect(can("OWNER", "finance.edit") && can("ACCOUNTANT", "finance.edit")).toBe(true);
  });
});
