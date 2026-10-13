DO $$ BEGIN
  CREATE TYPE "PromotionKind" AS ENUM ('BUY_GET', 'COMBO', 'THRESHOLD', 'FIRST_ORDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Promotion" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "kind" "PromotionKind" NOT NULL,
  "config" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "onSite" BOOLEAN NOT NULL DEFAULT true,
  "onPos" BOOLEAN NOT NULL DEFAULT true,
  "allowCode" BOOLEAN NOT NULL DEFAULT false,
  "withHappyHour" BOOLEAN NOT NULL DEFAULT false,
  "days" INTEGER[],
  "startMin" INTEGER NOT NULL DEFAULT 0,
  "endMin" INTEGER NOT NULL DEFAULT 1440,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "totalLimit" INTEGER,
  "perCustomerLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PromotionUse" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionUse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromotionUse_promotionId_customerId_idx" ON "PromotionUse"("promotionId", "customerId");
CREATE INDEX IF NOT EXISTS "PromotionUse_orderId_idx" ON "PromotionUse"("orderId");

DO $$ BEGIN
  ALTER TABLE "PromotionUse" ADD CONSTRAINT "PromotionUse_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PromotionUse" ADD CONSTRAINT "PromotionUse_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
