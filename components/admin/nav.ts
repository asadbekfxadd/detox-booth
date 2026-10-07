import type { Permission } from "@/lib/rbac";

export type NavItem = { label: string; href: string; perm: Permission; group: string };

export const NAV: NavItem[] = [
  { group: "Главное", label: "Обзор", href: "/admin/dashboard", perm: "dashboard.view" },
  { group: "Продажи", label: "Продажи", href: "/admin/sales", perm: "orders.view" },
  { group: "Продажи", label: "Заказы", href: "/admin/orders", perm: "orders.view" },
  { group: "Продажи", label: "Касса (POS)", href: "/pos", perm: "pos.use" },
  { group: "Меню", label: "Продукты", href: "/admin/products", perm: "products.edit" },
  { group: "Меню", label: "Категории", href: "/admin/categories", perm: "products.edit" },
  { group: "Меню", label: "Рецепты", href: "/admin/recipes", perm: "recipes.edit" },
  { group: "Склад", label: "Склад", href: "/admin/inventory", perm: "inventory.view" },
  { group: "Склад", label: "Ингредиенты", href: "/admin/ingredients", perm: "inventory.edit" },
  { group: "Склад", label: "Закупки", href: "/admin/purchases", perm: "purchases.manage" },
  { group: "Склад", label: "Поставщики", href: "/admin/suppliers", perm: "purchases.manage" },
  { group: "Склад", label: "Списания", href: "/admin/writeoffs", perm: "writeoffs.create" },
  { group: "Клиенты", label: "Клиенты", href: "/admin/customers", perm: "customers.view" },
  { group: "Клиенты", label: "Лояльность", href: "/admin/loyalty", perm: "customers.view" },
  { group: "Бизнес", label: "Сотрудники", href: "/admin/employees", perm: "employees.manage" },
  { group: "Бизнес", label: "Финансы", href: "/admin/finance", perm: "finance.view" },
  { group: "Бизнес", label: "Аналитика", href: "/admin/analytics", perm: "dashboard.view" },
  { group: "Бизнес", label: "Журнал действий", href: "/admin/audit", perm: "audit.view" },
  { group: "Бизнес", label: "Столы и QR", href: "/admin/tables", perm: "settings.edit" },
  { group: "Бизнес", label: "Настройки", href: "/admin/settings", perm: "settings.edit" },
];
