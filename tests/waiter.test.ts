import { describe, it, expect } from "vitest";
import { waiterOrderSchema, groupByCourse, heldOrders, defaultHold, waiterNote, courseLabel } from "@/lib/waiter";
import { can, homeFor, ROUTE_PERMISSIONS } from "@/lib/rbac";

describe("официант: заказ", () => {
  const item = { productId: "p1", quantity: 2, optionIds: [] };
  it("по умолчанию первая подача и без удержания", () => {
    const d = waiterOrderSchema.parse({ tableId: "t1", items: [item] });
    expect(d.course).toBe(1);
    expect(d.hold).toBe(false);
  });
  it("отклоняет пустой заказ, неверную подачу и стол без id", () => {
    expect(() => waiterOrderSchema.parse({ tableId: "t1", items: [] })).toThrow();
    expect(() => waiterOrderSchema.parse({ tableId: "t1", items: [item], course: 4 })).toThrow();
    expect(() => waiterOrderSchema.parse({ tableId: "", items: [item] })).toThrow();
  });
  it("горячее и десерт придерживаются по умолчанию, первая подача нет", () => {
    expect(defaultHold(1)).toBe(false);
    expect(defaultHold(2)).toBe(true);
    expect(defaultHold(3)).toBe(true);
  });
  it("комментарий для кухни содержит подачу и пометку", () => {
    expect(waiterNote(1, undefined)).toBeNull();
    expect(waiterNote(2, " без лука ")).toBe("Горячее. без лука");
    expect(waiterNote(1, "без сахара")).toBe("без сахара");
  });
  it("подписи подач", () => {
    expect(courseLabel(3)).toBe("Десерт");
    expect(courseLabel(9)).toBe("Подача 9");
  });
});

describe("официант: группировка", () => {
  const orders = [
    { id: "a", course: 2, status: "NEW", onHold: true },
    { id: "b", course: 1, status: "READY", onHold: false },
    { id: "c", course: 2, status: "NEW", onHold: false },
    { id: "d", course: 3, status: "NEW", onHold: true },
    { id: "e", course: 2, status: "CANCELLED", onHold: true },
  ];
  it("группирует по подачам в порядке подач", () => {
    expect(groupByCourse(orders).map((g) => [g.course, g.orders.length])).toEqual([[1, 1], [2, 3], [3, 1]]);
  });
  it("отложенные — только новые на удержании; можно ограничить подачей", () => {
    expect(heldOrders(orders).map((o) => o.id)).toEqual(["a", "d"]);
    expect(heldOrders(orders, 2).map((o) => o.id)).toEqual(["a"]);
  });
});

describe("официант: права", () => {
  it("роль «Официант» видит только зал", () => {
    expect(can("WAITER", "waiter.use")).toBe(true);
    for (const p of ["pos.use", "dashboard.view", "orders.manage", "inventory.view", "finance.view", "settings.edit"] as const) expect(can("WAITER", p)).toBe(false);
    expect(homeFor("WAITER")).toBe("/waiter");
  });
  it("баристу и склад в зал не пускаем", () => {
    expect(can("BARISTA", "waiter.use")).toBe(false);
    expect(can("WAREHOUSE", "waiter.use")).toBe(false);
  });
  it("кассир и после появления зала входит на кассу", () => {
    expect(homeFor("CASHIER")).toBe("/pos");
    expect(ROUTE_PERMISSIONS.some(([p, perm]) => p === "/waiter" && perm === "waiter.use")).toBe(true);
  });
});
