-- Доставка: роль курьера, зоны доставки, назначение курьера на заказ
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COURIER';

CREATE TABLE IF NOT EXISTS "DeliveryZone" (
  "id" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "minOrder" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "freeFrom" DECIMAL(14,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeliveryZone_locationId_isActive_idx" ON "DeliveryZone"("locationId", "isActive");
DO $$ BEGIN
  ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryZoneId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "courierId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "courierAssignedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Order_courierId_status_idx" ON "Order"("courierId", "status");
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
