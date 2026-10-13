-- Сервисный сбор (входит в сумму заказа) и чаевые (отдельно от выручки)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "serviceFee" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "tip" DECIMAL(14,2) NOT NULL DEFAULT 0;
