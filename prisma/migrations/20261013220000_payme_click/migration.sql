CREATE TABLE IF NOT EXISTS "PaymeTransaction" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT,
  "amount" BIGINT NOT NULL,
  "state" INTEGER NOT NULL,
  "reason" INTEGER,
  "time" BIGINT NOT NULL,
  "createTime" BIGINT NOT NULL,
  "performTime" BIGINT,
  "cancelTime" BIGINT,
  CONSTRAINT "PaymeTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymeTransaction_orderId_idx" ON "PaymeTransaction"("orderId");
CREATE INDEX IF NOT EXISTS "PaymeTransaction_createTime_idx" ON "PaymeTransaction"("createTime");

CREATE TABLE IF NOT EXISTS "ClickTransaction" (
  "id" SERIAL NOT NULL,
  "clickTransId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClickTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClickTransaction_clickTransId_key" ON "ClickTransaction"("clickTransId");
CREATE INDEX IF NOT EXISTS "ClickTransaction_orderId_idx" ON "ClickTransaction"("orderId");
