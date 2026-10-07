-- Индексы по внешним ключам и частым фильтрам (история клиента, заказы смены, позиции и платежи заказа).
-- IF NOT EXISTS: миграцию безопасно применять повторно и на базе, созданной через db push.
CREATE INDEX IF NOT EXISTS "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_shiftId_idx" ON "Order"("shiftId");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");
