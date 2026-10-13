-- Станции кухни (бар, горячий и холодный цех) и готовность позиций по станциям
CREATE TABLE IF NOT EXISTS "Station" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Station_name_key" ON "Station"("name");

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "stationId" TEXT;
CREATE INDEX IF NOT EXISTS "Category_stationId_idx" ON "Category"("stationId");
DO $$ BEGIN
  ALTER TABLE "Category" ADD CONSTRAINT "Category_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3);
