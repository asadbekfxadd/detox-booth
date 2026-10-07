-- Координаты точки для карты на сайте.
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;

-- Единственная рабочая точка: адрес и координаты из карточки в Яндекс Картах (рядом с Mango Cafe).
-- Трогаем только пустую точку; если владелец уже внёс свои данные в админке, они сохраняются.
UPDATE "Location"
SET "address" = 'Янгиюль, массив Навруз, 10, рядом с Mango Cafe', "lat" = 41.103801, "lng" = 69.043818
WHERE "lat" IS NULL AND ("address" IS NULL OR "address" = 'Ташкент')
  AND (SELECT COUNT(*) FROM "Location") = 1;
