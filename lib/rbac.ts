import type { Role } from "@prisma/client";

export type Permission =
  | "dashboard.view" | "finance.view" | "finance.edit"
  | "orders.view" | "orders.manage" | "orders.cancel" | "pos.use" | "pos.refund"
  | "products.edit" | "products.cost" | "recipes.edit"
  | "inventory.view" | "inventory.edit" | "writeoffs.create" | "purchases.manage"
  | "customers.view" | "customers.manage" | "employees.manage" | "settings.edit" | "audit.view";

const ALL: Permission[] = [
  "dashboard.view","finance.view","finance.edit","orders.view","orders.manage","orders.cancel","pos.use","pos.refund",
  "products.edit","products.cost","recipes.edit","inventory.view","inventory.edit","writeoffs.create",
  "purchases.manage","customers.view","customers.manage","employees.manage","settings.edit","audit.view",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== "finance.edit"),
  MANAGER: ["dashboard.view","orders.view","orders.manage","orders.cancel","pos.use","pos.refund","products.edit","recipes.edit",
            "inventory.view","inventory.edit","writeoffs.create","purchases.manage","customers.view","customers.manage"],
  CASHIER: ["orders.view","orders.manage","pos.use"],
  BARISTA: ["orders.view","orders.manage","inventory.view","writeoffs.create"],
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
  ["/admin/inventory", "inventory.view"],
  ["/admin/purchases", "purchases.manage"],
  ["/admin/writeoffs", "writeoffs.create"],
  ["/admin/customers", "customers.view"],
  ["/admin/employees", "employees.manage"],
  ["/admin/finance", "finance.view"],
  ["/admin/settings", "settings.edit"],
  ["/admin/tables", "settings.edit"],
  ["/admin/sales", "orders.view"],
  ["/admin/categories", "products.edit"],
  ["/admin/suppliers", "purchases.manage"],
  ["/admin/loyalty", "customers.view"],
  ["/admin/analytics", "dashboard.view"],
  ["/admin/audit", "audit.view"],
  ["/pos", "pos.use"],
  ["/kitchen", "orders.manage"],
];

/** Куда отправлять после входа */
export const homeFor = (role: Role) => (can(role, "dashboard.view") ? "/admin/dashboard" : can(role, "pos.use") ? "/pos" : can(role, "orders.manage") ? "/kitchen" : can(role, "inventory.view") ? "/admin/inventory" : "/forbidden");

/** Роли, которым доступен выбор точки (остальные привязаны к своей). */
export const canSwitchLocation = (role: string) => role === "OWNER" || role === "WAREHOUSE";
