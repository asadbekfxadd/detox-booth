-- Telegram-бот и Mini App: пользователи Telegram и привязка заказа к чату
CREATE TABLE "TelegramUser" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "languageCode" TEXT,
    "phone" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramUser_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "telegramId" TEXT;
CREATE INDEX "Order_telegramId_idx" ON "Order"("telegramId");
