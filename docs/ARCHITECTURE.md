# Vitamin B — архитектура
Стек: Next.js (App Router) + TS + Tailwind v4 + Prisma/PostgreSQL + Auth.js + Zod + Recharts + Zustand.
Отдельный backend не нужен: Route Handlers + слой services.

## Слои
app/ (UI + тонкие route handlers и серверные действия) -> services/* и lib/services/* (бизнес-логика, транзакции) -> Prisma.
Каждый handler: session -> assertCan(role, perm) -> Zod parse -> service -> audit -> JSON.

## Решения
- Деньги: Decimal, валюта UZS.
- Остаток: StockItem (быстро) + Batch (FEFO, сроки) + InventoryTransaction (журнал, основа для variance).
- Себестоимость не хранится в Product: считается из рецепта и Batch.unitCost; COGS фиксируется в Order.
- Списание идемпотентно (Order.inventoryDeducted) и атомарно ($transaction).
- Multi-location: locationId во всех операционных таблицах; OWNER видит все точки.
- RBAC: lib/rbac.ts. Cashier не имеет products.cost / finance.* / удаления.

- Склад и параллельность: операции с остатками берут `pg_advisory_xact_lock` точки (`lib/stock-lock.ts`), поэтому проверка наличия и списание партий выполняются как одно целое.
- Время: «сегодня» и границы отчётов считаются по Ташкенту (`lib/time.ts`), в БД всё хранится в UTC.
- Онлайн-оплата: интерфейс `PaymentProvider` (`services/payments`), вебхук проверяет подпись и идемпотентно переводит Payment из PENDING в PAID/FAILED.
- Защита от перебора: `lib/rate-limit.ts` (в памяти процесса; для нескольких экземпляров нужен Redis).

## Цепочки
Web: Cart -> Order(NEW, время получения, комментарий) -> Payment(PAID при получении или онлайн) -> CONFIRMED -> PREPARING -> READY -> COMPLETED. Кухня (/kitchen) двигает заказ по тем же статусам; списание склада — при подтверждении.
POS: Order+Payment сразу -> fulfillOrder.
Purchase RECEIVED -> Batch + StockItem + Tx(PURCHASE) + пересчёт avgCost.
Write-off -> Tx(WRITE_OFF) + StockItem + AuditLog + Notification при крупном списании.

## План
5 Auth -> 6 Admin shell -> 7 Products -> 8 Recipes -> 9 Inventory/Purchasing/Write-offs/Variance -> 10 POS+Shifts
-> 11 Orders -> 12-13 Customer site+Checkout -> 14 CRM/Loyalty/Promo -> 15 Analytics -> 16 Audit -> 17 Tests -> 18 Polish.
