-- Роль официанта: заказ у стола с телефона, подача по очередям.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WAITER';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "waiterId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "course" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "onHold" BOOLEAN NOT NULL DEFAULT false;
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Order_waiterId_idx" ON "Order"("waiterId");
