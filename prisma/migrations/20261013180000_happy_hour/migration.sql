CREATE TABLE IF NOT EXISTS "HappyHour" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "percent" INTEGER NOT NULL,
  "days" INTEGER[],
  "startMin" INTEGER NOT NULL,
  "endMin" INTEGER NOT NULL,
  "categoryId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HappyHour_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "HappyHour" ADD CONSTRAINT "HappyHour_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
