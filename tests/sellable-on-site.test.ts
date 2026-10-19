import { describe, it, expect } from "vitest";
import { assertSellableOnSite } from "@/services/availability";

type P = { name: string; recipe: { _count: { items: number } } | null };
const fake = (setting: unknown, products: P[]) => ({
  setting: { findUnique: async () => (setting === undefined ? null : { value: setting }) },
  product: { findMany: async () => products },
}) as never;
const item = (productId: string, extra: object = {}) => ({ productId, quantity: 1, optionIds: [], ...extra });

describe("сайт: продукт без рецепта «Скоро будет доступно»", () => {
  const withRecipe: P = { name: "Лимонад", recipe: { _count: { items: 2 } } };
  const noRecipe: P = { name: "Боул", recipe: null };
  const emptyRecipe: P = { name: "Смузи", recipe: { _count: { items: 0 } } };

  it("продукт с рецептом можно заказать", async () => {
    await expect(assertSellableOnSite(fake(undefined, [withRecipe]), [item("a")])).resolves.toBeUndefined();
  });
  it("без рецепта и с пустым рецептом нельзя, в ошибке названия", async () => {
    await expect(assertSellableOnSite(fake(undefined, [withRecipe, noRecipe, emptyRecipe]), [item("a"), item("b"), item("c")])).rejects.toThrow(/Скоро будет доступно: Боул, Смузи/);
  });
  it("настройка выключена — можно всё", async () => {
    await expect(assertSellableOnSite(fake(0, [noRecipe]), [item("b")])).resolves.toBeUndefined();
    await expect(assertSellableOnSite(fake(1, [noRecipe]), [item("b")])).rejects.toThrow();
  });
  it("«Свой микс» не проверяется: состав в самой позиции", async () => {
    await expect(assertSellableOnSite(fake(undefined, [noRecipe]), [item("m", { mix: { sizeId: "s", ingredientIds: ["x"] } })])).resolves.toBeUndefined();
    await expect(assertSellableOnSite(fake(undefined, [noRecipe]), [item("m", { mixNeeds: [{ ingredientId: "x", qty: 1 }] })])).resolves.toBeUndefined();
  });
});
