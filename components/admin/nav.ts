import type { Permission } from "@/lib/rbac";

/** match — другие адреса раздела: пункт меню остаётся подсвеченным, пока человек внутри них */
export type NavItem = { label: string; href: string; perm: Permission; group: string; match?: string[] };

export const NAV: NavItem[] = [
  { group: "Главное", label: "Обзор", href: "/admin/dashboard", perm: "dashboard.view" },
  { group: "Продажи", label: "Продажи", href: "/admin/sales", perm: "orders.view" },
  { group: "Продажи", label: "Заказы", href: "/admin/orders", perm: "orders.view" },
  { group: "Продажи", label: "Касса (POS)", href: "/pos", perm: "pos.use" },
  { group: "Продажи", label: "Официант", href: "/waiter", perm: "waiter.use" },
  { group: "Продажи", label: "Бронь столов", href: "/admin/reservations", perm: "reservations.manage" },
  { group: "Продажи", label: "Доставка", href: "/admin/delivery", perm: "orders.manage" },
  { group: "Меню", label: "Продукты", href: "/admin/products", perm: "products.edit" },
  { group: "Меню", label: "Категории", href: "/admin/categories", perm: "products.edit" },
  { group: "Меню", label: "Рецепты", href: "/admin/recipes", perm: "recipes.edit" },
  { group: "Меню", label: "Свой микс", href: "/admin/mix", perm: "products.edit" },
  { group: "Меню", label: "Калькуляция", href: "/admin/costing", perm: "finance.view" },
  { group: "Склад", label: "Склад", href: "/admin/inventory", perm: "inventory.view", match: ["/admin/ingredients", "/admin/purchases", "/admin/suppliers", "/admin/writeoffs"] },
  { group: "Клиенты", label: "Клиенты", href: "/admin/customers", perm: "customers.view" },
  { group: "Клиенты", label: "Лояльность", href: "/admin/loyalty", perm: "customers.view" },
  { group: "Клиенты", label: "Счастливые часы", href: "/admin/happy-hour", perm: "settings.edit" },
  { group: "Клиенты", label: "Акции", href: "/admin/promotions", perm: "settings.edit" },
  { group: "Бизнес", label: "Сотрудники", href: "/admin/employees", perm: "employees.manage" },
  { group: "Бизнес", label: "Финансы", href: "/admin/finance", perm: "finance.view" },
  { group: "Бизнес", label: "Календарь выручки", href: "/admin/calendar", perm: "finance.view" },
  { group: "Бизнес", label: "Аналитика", href: "/admin/analytics", perm: "dashboard.view" },
  { group: "Бизнес", label: "Журнал действий", href: "/admin/audit", perm: "audit.view" },
  { group: "Бизнес", label: "Столы и QR", href: "/admin/tables", perm: "settings.edit" },
  { group: "Бизнес", label: "Бренд и сайт", href: "/admin/brand", perm: "settings.edit" },
  { group: "Бизнес", label: "Telegram-бот", href: "/admin/telegram", perm: "settings.edit" },
  { group: "Бизнес", label: "Настройки", href: "/admin/settings", perm: "settings.edit" },
];
