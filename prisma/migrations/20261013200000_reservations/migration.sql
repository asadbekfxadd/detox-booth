DO $$ BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "DiningTable" ADD COLUMN IF NOT EXISTS "seats" INTEGER NOT NULL DEFAULT 4;

CREATE TABLE IF NOT EXISTS "Reservation" (
  "id" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "tableId" TEXT,
  "customerId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "guests" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "durationMin" INTEGER NOT NULL DEFAULT 90,
  "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "deposit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "depositPaid" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'WEB',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Reservation_locationId_startsAt_idx" ON "Reservation"("locationId", "startsAt");
CREATE INDEX IF NOT EXISTS "Reservation_tableId_startsAt_idx" ON "Reservation"("tableId", "startsAt");
CREATE INDEX IF NOT EXISTS "Reservation_phone_idx" ON "Reservation"("phone");
DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
