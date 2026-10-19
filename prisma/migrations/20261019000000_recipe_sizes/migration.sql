-- Граммовка ингредиента на порцию для каждого размера (опции «Объём»)
CREATE TABLE "RecipeSizeItem" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    CONSTRAINT "RecipeSizeItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeSizeItem_optionId_ingredientId_key" ON "RecipeSizeItem"("optionId", "ingredientId");
CREATE INDEX "RecipeSizeItem_recipeId_idx" ON "RecipeSizeItem"("recipeId");

ALTER TABLE "RecipeSizeItem" ADD CONSTRAINT "RecipeSizeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeSizeItem" ADD CONSTRAINT "RecipeSizeItem_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ModifierOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeSizeItem" ADD CONSTRAINT "RecipeSizeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
