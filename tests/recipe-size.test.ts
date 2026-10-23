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
import { mlOf, pickReference, sizeRatio } from "@/lib/recipe-size";
describe("recipeSchema: размеры, цены и название из рецепта", () => {
  const items = [{ ingredientId: "a", quantity: 30 }];
  it("принимает цены ингредиентов, название и размеры (новый размер без id)", () => {
    const r = recipeSchema.parse({ name: " Апельсин ", prices: [{ ingredientId: "a", price: "60000" }], sizes: [{ optionId: "o", name: " 330 мл ", price: 28000, items }, { name: "500 мл", price: "40000", items }] });
    expect(r.prices?.[0].price).toBe(60000);
    expect(r.sizes?.[0].name).toBe("330 мл");
    expect(r.sizes?.[1].optionId).toBeUndefined();
    expect(r.sizes?.[1].price).toBe(40000);
    expect(r.name).toBe("Апельсин");
  });
  it("нужны ингредиенты или размеры; цена не отрицательная; название размера не пустое", () => {
    expect(() => recipeSchema.parse({})).toThrow();
    expect(() => recipeSchema.parse({ items, prices: [{ ingredientId: "a", price: -1 }] })).toThrow();
    expect(() => recipeSchema.parse({ sizes: [{ name: " ", price: 1, items }] })).toThrow();
    expect(() => recipeSchema.parse({ sizes: [{ name: "250 мл", price: 1, items: [] }] })).toThrow();
  });
});

describe("объём из названия размера", () => {
  it("мл, л и десятичные", () => {
    expect(mlOf("330 мл")).toBe(330);
    expect(mlOf("1 л")).toBe(1000);
    expect(mlOf("0,5 л")).toBe(500);
    expect(mlOf("500мл")).toBe(500);
    expect(mlOf("Большой")).toBeNull();
    expect(mlOf("Литр")).toBeNull();
  });
  it("пропорция и образец для копирования", () => {
    expect(sizeRatio("500 мл", "250 мл")).toBe(0.5);
    expect(sizeRatio("Малый", "250 мл")).toBe(1);
    const cols = [{ name: "300 мл" }, { name: "500 мл" }];
    expect(pickReference(cols, "250 мл")?.name).toBe("300 мл");
    expect(pickReference(cols, "450 мл")?.name).toBe("500 мл");
    expect(pickReference(cols, "Свой")?.name).toBe("500 мл");
    expect(pickReference([], "250 мл")).toBeNull();
  });
});
