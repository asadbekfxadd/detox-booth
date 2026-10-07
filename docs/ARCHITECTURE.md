# Vitamin B — архитектура
Стек без изменений: Next.js (App Router) + TS + Tailwind + shadcn/ui + Prisma/PostgreSQL + Auth.js + Zod + Recharts + Zustand.
Отдельный backend не нужен: Route Handlers + слой services.

## Слои
app/ (UI + тонкие route handlers) -> lib/services/* (бизнес-логика, транзакции) -> Prisma.
Каждый handler: session -> assertCan(role, perm) -> Zod parse -> service -> audit -> JSON.

## Решения
- Деньги: Decimal, валюта UZS.
- Остаток: StockItem (быстро) + Batch (FEFO, сроки) + InventoryTransaction (журнал, основа для variance).
- Себестоимость не хранится в Product: считается из рецепта и Batch.unitCost; COGS фиксируется в Order.
- Списание идемпотентно (Order.inventoryDeducted) и атомарно ($transaction).
- Multi-location: locationId во всех операционных таблицах; OWNER видит все точки.
- RBAC: lib/rbac.ts. Cashier не имеет products.cost / finance.* / удаления.

## Цепочки
Web: Cart -> Order(NEW) -> Payment(PAID) -> CONFIRMED -> fulfillOrder -> COMPLETED.
POS: Order+Payment сразу -> fulfillOrder.
Purchase RECEIVED -> Batch + StockItem + Tx(PURCHASE) + пересчёт avgCost.
Write-off -> Tx(WRITE_OFF) + StockItem + AuditLog + Notification при крупном списании.

## План
5 Auth -> 6 Admin shell -> 7 Products -> 8 Recipes -> 9 Inventory/Purchasing/Write-offs/Variance -> 10 POS+Shifts
-> 11 Orders -> 12-13 Customer site+Checkout -> 14 CRM/Loyalty/Promo -> 15 Analytics -> 16 Audit -> 17 Tests -> 18 Polish.
