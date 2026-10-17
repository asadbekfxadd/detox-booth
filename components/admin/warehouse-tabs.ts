/** Вкладки раздела «Склад». Отдельный файл без "use client": список нужен серверному layout, а в клиентском модуле он превратился бы в ссылку. */
export type WarehouseTab = { label: string; href: string; match: string[] };

export const WAREHOUSE_TABS: (WarehouseTab & { perm: "inventory.view" | "purchases.manage" | "writeoffs.create" })[] = [
  { label: "Продукты и остатки", href: "/admin/inventory", perm: "inventory.view", match: ["/admin/inventory", "/admin/ingredients"] },
  { label: "Закупки", href: "/admin/purchases", perm: "purchases.manage", match: ["/admin/purchases"] },
  { label: "Поставщики", href: "/admin/suppliers", perm: "purchases.manage", match: ["/admin/suppliers"] },
  { label: "Списания", href: "/admin/writeoffs", perm: "writeoffs.create", match: ["/admin/writeoffs"] },
  { label: "Партии и сроки", href: "/admin/inventory/batches", perm: "inventory.view", match: ["/admin/inventory/batches"] },
  { label: "Расхождения", href: "/admin/inventory/variance", perm: "inventory.view", match: ["/admin/inventory/variance"] },
];
