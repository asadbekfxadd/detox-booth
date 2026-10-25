-- Выход годного после обработки (брутто → нетто), %. 100 = без потерь, поведение прежнее
ALTER TABLE "Ingredient" ADD COLUMN "yieldPct" DECIMAL(5,2) NOT NULL DEFAULT 100;
