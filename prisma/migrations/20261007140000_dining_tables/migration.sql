-- Столики и счета столов (заказ гостя по QR-коду).
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'TABLE';

DO $$ BEGIN
  CREATE TYPE "BillStatus" AS ENUM ('OPEN', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DiningTable" (
  "id" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiningTable_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DiningTable_token_key" ON "DiningTable"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "DiningTable_locationId_number_key" ON "DiningTable"("locationId", "number");

CREATE TABLE IF NOT EXISTS "TableBill" (
  "id" TEXT NOT NULL,
  "number" SERIAL NOT NULL,
  "tableId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "status" "BillStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "billRequestedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "shiftId" TEXT,
  "method" "PaymentMethod",
  "total" DECIMAL(14,2),
  CONSTRAINT "TableBill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TableBill_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TableBill_tableId_status_idx" ON "TableBill"("tableId", "status");
CREATE INDEX IF NOT EXISTS "TableBill_locationId_status_idx" ON "TableBill"("locationId", "status");
-- Не больше одного открытого счёта на стол, даже при одновременных заказах.
CREATE UNIQUE INDEX IF NOT EXISTS "TableBill_one_open_per_table" ON "TableBill"("tableId") WHERE "status" = 'OPEN';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tableId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_billId_fkey" FOREIGN KEY ("billId") REFERENCES "TableBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Order_billId_idx" ON "Order"("billId");
CREATE INDEX IF NOT EXISTS "Order_tableId_status_idx" ON "Order"("tableId", "status");

-- 10 столов для единственной точки (если столов ещё нет). Токен из криптостойкого генератора.
INSERT INTO "DiningTable" ("id", "locationId", "number", "token")
SELECT 'tbl_' || replace(gen_random_uuid()::text, '-', ''), l."id", g.n, replace(gen_random_uuid()::text, '-', '')
FROM (SELECT "id" FROM "Location" WHERE "isActive" ORDER BY "createdAt" LIMIT 1) l
CROSS JOIN generate_series(1, 10) AS g(n)
WHERE (SELECT COUNT(*) FROM "Location" WHERE "isActive") = 1
  AND NOT EXISTS (SELECT 1 FROM "DiningTable")
ON CONFLICT DO NOTHING;
