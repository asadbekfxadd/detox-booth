import type { Role } from "@prisma/client";

export type Permission =
  | "dashboard.view" | "finance.view" | "finance.edit"
  | "orders.view" | "orders.manage" | "orders.cancel" | "pos.use" | "pos.refund"
  | "products.edit" | "products.cost" | "recipes.edit"
  | "inventory.view" | "inventory.edit" | "writeoffs.create" | "purchases.manage"
  | "customers.view" | "customers.manage" | "employees.manage" | "settings.edit" | "audit.view"
  | "waiter.use" | "print.use" | "courier.use" | "reservations.manage";

const ALL: Permission[] = [
  "dashboard.view","finance.view","finance.edit","orders.view","orders.manage","orders.cancel","pos.use","pos.refund",
  "products.edit","products.cost","recipes.edit","inventory.view","inventory.edit","writeoffs.create",
  "purchases.manage","customers.view","customers.manage","employees.manage","settings.edit","audit.view","waiter.use","print.use","courier.use","reservations.manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== "finance.edit"),
  MANAGER: ["dashboard.view","orders.view","orders.manage","orders.cancel","pos.use","pos.refund","products.edit","recipes.edit",
            "inventory.view","inventory.edit","writeoffs.create","purchases.manage","customers.view","customers.manage","waiter.use","print.use","courier.use","reservations.manage"],
  CASHIER: ["orders.view","orders.manage","pos.use","waiter.use","print.use","reservations.manage"],
  WAITER: ["waiter.use","print.use"],
  COURIER: ["courier.use","print.use"],
  BARISTA: ["orders.view","orders.manage","inventory.view","writeoffs.create","print.use"],
  WAREHOUSE: ["inventory.view","inventory.edit","writeoffs.create","purchases.manage"],
  ACCOUNTANT: ["dashboard.view","finance.view","finance.edit","orders.view","audit.view"],
};

export const can = (role: Role, p: Permission) => ROLE_PERMISSIONS[role].includes(p);
export function assertCan(role: Role, p: Permission) {
  if (!can(role, p)) throw new Error("FORBIDDEN");
}

/** Какой странице какое право нужно. Всё, что под /admin и не перечислено, требует dashboard.view (default-deny). */
export const ROUTE_PERMISSIONS: [string, Permission][] = [
  ["/admin/dashboard", "dashboard.view"],
  ["/admin/orders", "orders.view"],
  ["/admin/products", "products.edit"],
  ["/admin/recipes", "recipes.edit"],
  ["/admin/ingredients", "inventory.edit"],
  ["/admin/inventory", "inventory.view"],
  ["/admin/purchases", "purchases.manage"],
  ["/admin/writeoffs", "writeoffs.create"],
  ["/admin/customers", "customers.view"],
  ["/admin/employees", "employees.manage"],
  ["/admin/finance", "finance.view"],
  ["/admin/settings", "settings.edit"],
  ["/admin/brand", "settings.edit"],
  ["/admin/tables", "settings.edit"],
  ["/admin/sales", "orders.view"],
  ["/admin/categories", "products.edit"],
  ["/admin/stations", "products.edit"],
  ["/admin/suppliers", "purchases.manage"],
  ["/admin/loyalty", "customers.view"],
  ["/admin/analytics", "dashboard.view"],
  ["/admin/audit", "audit.view"],
  ["/pos", "pos.use"],
  ["/kitchen", "orders.manage"],
  ["/waiter", "waiter.use"],
  ["/print", "print.use"],
  ["/courier", "courier.use"],
  ["/admin/delivery/zones", "settings.edit"],
  ["/admin/happy-hour", "settings.edit"],
  ["/admin/reservations", "reservations.manage"],
  ["/admin/delivery", "orders.manage"],
];

/** Куда отправлять после входа */
export const homeFor = (role: Role) => (can(role, "dashboard.view") ? "/admin/dashboard" : can(role, "pos.use") ? "/pos" : can(role, "waiter.use") ? "/waiter" : can(role, "courier.use") ? "/courier" : can(role, "orders.manage") ? "/kitchen" : can(role, "inventory.view") ? "/admin/inventory" : "/forbidden");

/** Роли, которым доступен выбор точки (остальные привязаны к своей). */
export const canSwitchLocation = (role: string) => role === "OWNER" || role === "WAREHOUSE";
