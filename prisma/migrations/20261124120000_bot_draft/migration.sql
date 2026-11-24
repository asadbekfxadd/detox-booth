-- Корзина закупа в Telegram: «закуп» → список ингредиентов кнопками → количество и цена ответом → «Записать»
CREATE TABLE "BotDraft" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "pendingIngredientId" TEXT,
    "promptMessageId" INTEGER,
    "page" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotDraft_chatId_messageId_key" ON "BotDraft"("chatId", "messageId");
CREATE INDEX "BotDraft_createdAt_idx" ON "BotDraft"("createdAt");
