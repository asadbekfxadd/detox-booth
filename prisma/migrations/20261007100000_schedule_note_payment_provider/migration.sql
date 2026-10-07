-- Время получения и комментарий к заказу, телефон точки, данные платёжного провайдера.
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_externalId_key" ON "Payment"("provider", "externalId");
