import { describe, it, expect } from "vitest";
import { can, canSwitchLocation, homeFor, ROLE_PERMISSIONS, ROUTE_PERMISSIONS } from "@/lib/rbac";
import type { Role } from "@prisma/client";

describe("права ролей", () => {
  it("кассир не видит финансы, себестоимость, сотрудников и настройки", () => {
    for (const p of ["finance.view", "finance.edit", "products.cost", "products.edit", "employees.manage", "settings.edit", "audit.view", "pos.refund"] as const)
      expect(can("CASHIER", p)).toBe(false);
  });
  it("кассир может продавать и вести заказы", () => {
    expect(can("CASHIER", "pos.use")).toBe(true);
    expect(can("CASHIER", "orders.manage")).toBe(true);
  });
  it("бариста и склад не имеют доступа к кассе", () => {
    expect(can("BARISTA", "pos.use")).toBe(false);
    expect(can("WAREHOUSE", "pos.use")).toBe(false);
  });
  it("администратор не правит финансы, владелец — всё", () => {
    expect(can("ADMIN", "finance.edit")).toBe(false);
    expect(can("OWNER", "finance.edit")).toBe(true);
  });
  it("журнал действий — только владелец, администратор и бухгалтер", () => {
    const allowed = (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((r) => can(r, "audit.view")).sort();
    expect(allowed).toEqual(["ACCOUNTANT", "ADMIN", "OWNER"]);
  });
  it("у каждого маршрута есть известное право", () => {
    const known = new Set(Object.values(ROLE_PERMISSIONS).flat());
    for (const [, perm] of ROUTE_PERMISSIONS) expect(known.has(perm)).toBe(true);
  });
  it("точку переключают только владелец и склад", () => {
    expect(["OWNER", "WAREHOUSE"].every(canSwitchLocation)).toBe(true);
    expect(["ADMIN", "CASHIER", "BARISTA", "MANAGER", "ACCOUNTANT"].some(canSwitchLocation)).toBe(false);
  });
  it("каждая роль попадает на понятную стартовую страницу", () => {
    expect(homeFor("OWNER")).toBe("/admin/dashboard");
    expect(homeFor("CASHIER")).toBe("/pos");
    expect(homeFor("WAREHOUSE")).toBe("/admin/inventory");
  });
});
