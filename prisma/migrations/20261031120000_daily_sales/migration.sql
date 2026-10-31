-- CreateTable
CREATE TABLE "DailySales" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod",
    "ordersCount" INTEGER,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailySales_day_locationId_idx" ON "DailySales"("day", "locationId");

-- AddForeignKey
ALTER TABLE "DailySales" ADD CONSTRAINT "DailySales_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
