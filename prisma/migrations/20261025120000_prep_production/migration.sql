-- Заготовки (полуфабрикаты) и акты приготовления
ALTER TYPE "TxType" ADD VALUE IF NOT EXISTS 'PRODUCTION_OUT';
ALTER TYPE "TxType" ADD VALUE IF NOT EXISTS 'PRODUCTION_IN';

CREATE TABLE "PrepRecipe" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "outputQty" DECIMAL(12,3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrepRecipe_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrepRecipe_ingredientId_key" ON "PrepRecipe"("ingredientId");

CREATE TABLE "PrepRecipeItem" (
    "id" TEXT NOT NULL,
    "prepId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    CONSTRAINT "PrepRecipeItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrepRecipeItem_prepId_ingredientId_key" ON "PrepRecipeItem"("prepId", "ingredientId");

CREATE TABLE "ProductionAct" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "locationId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "plannedQty" DECIMAL(12,3) NOT NULL,
    "outputQty" DECIMAL(12,3) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionAct_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductionAct_locationId_createdAt_idx" ON "ProductionAct"("locationId", "createdAt");
CREATE INDEX "ProductionAct_ingredientId_idx" ON "ProductionAct"("ingredientId");

CREATE TABLE "ProductionActItem" (
    "id" TEXT NOT NULL,
    "actId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "ProductionActItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductionActItem_actId_idx" ON "ProductionActItem"("actId");

ALTER TABLE "PrepRecipe" ADD CONSTRAINT "PrepRecipe_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepRecipeItem" ADD CONSTRAINT "PrepRecipeItem_prepId_fkey" FOREIGN KEY ("prepId") REFERENCES "PrepRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrepRecipeItem" ADD CONSTRAINT "PrepRecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionAct" ADD CONSTRAINT "ProductionAct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionAct" ADD CONSTRAINT "ProductionAct_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionActItem" ADD CONSTRAINT "ProductionActItem_actId_fkey" FOREIGN KEY ("actId") REFERENCES "ProductionAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionActItem" ADD CONSTRAINT "ProductionActItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
