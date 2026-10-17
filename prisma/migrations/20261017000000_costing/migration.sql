ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monthlySalary" DECIMAL(14,2);

CREATE TABLE IF NOT EXISTS "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "lifeDrinks" INTEGER NOT NULL,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Equipment_categoryId_idx" ON "Equipment"("categoryId");

DO $$ BEGIN
  ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
