-- Геопозиция из Telegram: у пользователя и точка доставки в заказе
ALTER TABLE "TelegramUser" ADD COLUMN "lat" DOUBLE PRECISION, ADD COLUMN "lng" DOUBLE PRECISION, ADD COLUMN "locatedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "deliveryLat" DOUBLE PRECISION, ADD COLUMN "deliveryLng" DOUBLE PRECISION;
