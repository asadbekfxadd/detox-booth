import { describe, expect, it } from "vitest";
import { findSizeModifier, pickSizeRows } from "@/lib/recipe-size";

const opt = (id: string) => ({ id, name: id, priceDelta: 0 });

describe("findSizeModifier", () => {
  it("находит обязательный одиночный выбор «Объём»", () => {
    const m = findSizeModifier([
      { id: "a", name: "Добавки", required: false, multiple: true, options: [opt("x"), opt("y")] },
      { id: "b", name: "Объём", required: true, multiple: false, options: [opt("300"), opt("500")] },
    ] as never);
    expect(m?.id).toBe("b");
  });
  it("игнорирует необязательные и множественные группы", () => {
    expect(findSizeModifier([{ id: "a", name: "Объём", required: false, multiple: false, options: [opt("1"), opt("2")] }] as never)).toBeNull();
    expect(findSizeModifier([{ id: "a", name: "Объём", required: true, multiple: true, options: [opt("1"), opt("2")] }] as never)).toBeNull();
  });
  it("не считает размером группу с одним вариантом или другим названием", () => {
    expect(findSizeModifier([{ id: "a", name: "Объём", required: true, multiple: false, options: [opt("1")] }] as never)).toBeNull();
    expect(findSizeModifier([{ id: "a", name: "Сироп", required: true, multiple: false, options: [opt("1"), opt("2")] }] as never)).toBeNull();
  });
});

describe("pickSizeRows", () => {
  const rows = [
    { optionId: "300", ingredientId: "o", quantity: 150 },
    { optionId: "500", ingredientId: "o", quantity: 250 },
  ];
  it("берёт граммовку выбранного размера", () => {
    expect(pickSizeRows(rows as never, ["500"])?.[0].quantity).toBe(250);
    expect(pickSizeRows(rows as never, ["300"])?.[0].quantity).toBe(150);
  });
  it("без своих строк возвращает null (работает базовый рецепт × множитель)", () => {
    expect(pickSizeRows(rows as never, ["other"])).toBeNull();
    expect(pickSizeRows([], ["300"])).toBeNull();
  });
});

import { recipeSchema } from "@/services/recipes";
describe("recipeSchema: цены и размеры из рецепта", () => {
  const items = [{ ingredientId: "a", quantity: 30 }];
  it("принимает цены ингредиентов и название/цену размера", () => {
    const r = recipeSchema.parse({ items, prices: [{ ingredientId: "a", price: "60000" }], sizeEdits: [{ optionId: "o", name: " 330 мл ", price: 28000 }] });
    expect(r.prices?.[0].price).toBe(60000);
    expect(r.sizeEdits?.[0].name).toBe("330 мл");
  });
  it("отклоняет отрицательную цену и пустое название размера", () => {
    expect(() => recipeSchema.parse({ items, prices: [{ ingredientId: "a", price: -1 }] })).toThrow();
    expect(() => recipeSchema.parse({ items, sizeEdits: [{ optionId: "o", name: " ", price: 1 }] })).toThrow();
  });
});
