import { describe, it, expect } from "vitest";
import { linesFor, isDone, progress, parseStationFilter, stationsOf, NO_STATION } from "@/lib/station";
import { billReceiptTotals } from "@/lib/receipt";
import { can, ROUTE_PERMISSIONS } from "@/lib/rbac";

const L = (stationId: string | null, readyAt: string | null = null) => ({ stationId, readyAt });

describe("станции кухни", () => {
  const lines = [L("bar"), L("hot"), L(null), L("bar", "2026-10-13T10:00:00Z")];
  it("фильтр: пусто — все, станция — свои, none — без станции", () => {
    expect(linesFor(lines, null)).toHaveLength(4);
    expect(linesFor(lines, "bar")).toHaveLength(2);
    expect(linesFor(lines, "hot")).toHaveLength(1);
    expect(linesFor(lines, NO_STATION)).toHaveLength(1);
    expect(linesFor(lines, "cold")).toHaveLength(0);
  });
  it("параметр адреса: неизвестная станция считается «все»", () => {
    expect(parseStationFilter(undefined, ["bar"])).toBeNull();
    expect(parseStationFilter("", ["bar"])).toBeNull();
    expect(parseStationFilter("bar", ["bar", "hot"])).toBe("bar");
    expect(parseStationFilter("zzz", ["bar"])).toBeNull();
    expect(parseStationFilter("none", [])).toBe(NO_STATION);
  });
  it("готовность: пустой набор не готов, все отмечены — готов", () => {
    expect(isDone([])).toBe(false);
    expect(isDone([L("bar", "x"), L("bar", "y")])).toBe(true);
    expect(isDone([L("bar", "x"), L("bar")])).toBe(false);
    expect(progress(lines)).toEqual({ done: 1, total: 4 });
  });
  it("станции заказа без повторов", () => {
    expect(stationsOf(lines)).toEqual(["bar", "hot", null]);
  });
});

describe("итоги чека стола", () => {
  const o = (status: string, total: number, paid: boolean, serviceFee = 0, tip = 0) => ({ status, total, paid, serviceFee, tip });
  it("предварительный счёт: сбор считается по текущему проценту", () => {
    const t = billReceiptTotals([o("COMPLETED", 100000, false), o("READY", 50000, false), o("CANCELLED", 99999, false)], 10);
    expect(t).toMatchObject({ subtotal: 150000, fee: 15000, total: 165000, paid: 0, due: 165000, closed: false });
  });
  it("частично оплачен: у оплаченного сбор уже внутри суммы", () => {
    const t = billReceiptTotals([o("COMPLETED", 110000, true, 10000, 5000), o("COMPLETED", 50000, false)], 10);
    expect(t).toMatchObject({ subtotal: 150000, fee: 15000, total: 165000, paid: 110000, due: 55000, tip: 5000, closed: false });
  });
  it("всё оплачено — чек закрыт, к оплате 0", () => {
    const t = billReceiptTotals([o("COMPLETED", 110000, true, 10000), o("COMPLETED", 55000, true, 5000)], 10);
    expect(t).toMatchObject({ total: 165000, due: 0, closed: true });
  });
  it("без заказов — не закрыт", () => {
    expect(billReceiptTotals([], 10).closed).toBe(false);
  });
});

describe("печать: права", () => {
  it("печать доступна залу, кассе и кухне, но не складу и бухгалтеру", () => {
    for (const r of ["OWNER", "ADMIN", "MANAGER", "CASHIER", "WAITER", "BARISTA"] as const) expect(can(r, "print.use")).toBe(true);
    for (const r of ["WAREHOUSE", "ACCOUNTANT"] as const) expect(can(r, "print.use")).toBe(false);
  });
  it("маршрут /print и /admin/stations защищены", () => {
    expect(ROUTE_PERMISSIONS).toContainEqual(["/print", "print.use"]);
    expect(ROUTE_PERMISSIONS).toContainEqual(["/admin/stations", "products.edit"]);
  });
});
