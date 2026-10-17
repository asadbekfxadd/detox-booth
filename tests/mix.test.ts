import { describe, it, expect } from "vitest";
import { gramsToQty, mixable, mixKey, mixModifiers, mixNeedsFromModifiers, mixPortions, mixPrice, type MixIngredient, type MixSize } from "@/lib/mix";

const ing = (o: Partial<MixIngredient> & { id: string }): MixIngredient => ({ name: o.id, category: "Фрукты", unit: "G", surcharge: 0, pieceWeightG: null, ...o });
const size: MixSize = { id: "m400", name: "400 мл", price: 25000, grams: 480, cupIngredientId: "cup" };

describe("mix: цена", () => {
  it("цена размера + доплаты за ингредиенты", () => {
    expect(mixPrice(size, [ing({ id: "apple" }), ing({ id: "mango", surcharge: 4000 }), ing({ id: "avocado", surcharge: 6000 })])).toBe(35000);
  });
  it("без доплат — просто цена размера", () => expect(mixPrice(size, [ing({ id: "apple" })])).toBe(25000));
  it("отрицательная доплата не уменьшает цену", () => expect(mixPrice(size, [ing({ id: "x", surcharge: -500 })])).toBe(25000));
});

describe("mix: состав", () => {
  it("масса делится поровну", () => {
    const p = mixPortions(size, [ing({ id: "a" }), ing({ id: "b" }), ing({ id: "c" })]);
    expect(p.map((x) => x.qty)).toEqual([160, 160, 160]);
  });
  it("один ингредиент получает всю массу", () => expect(mixPortions(size, [ing({ id: "a" })])[0].qty).toBe(480));
  it("пустой выбор — пустой состав", () => expect(mixPortions(size, [])).toEqual([]));
  it("мл считаются как граммы, кг и л — в тысячных", () => {
    expect(gramsToQty({ unit: "ML", pieceWeightG: null }, 120)).toBe(120);
    expect(gramsToQty({ unit: "KG", pieceWeightG: null }, 250)).toBe(0.25);
    expect(gramsToQty({ unit: "L", pieceWeightG: null }, 250)).toBe(0.25);
  });
  it("штуки переводятся по весу штуки", () => {
    expect(gramsToQty({ unit: "PC", pieceWeightG: 80 }, 160)).toBe(2);
    expect(gramsToQty({ unit: "PC", pieceWeightG: 150 }, 100)).toBeCloseTo(0.667, 3);
    expect(gramsToQty({ unit: "PC", pieceWeightG: null }, 100)).toBe(0);
  });
  it("дробные граммы округляются до сотых", () => {
    const p = mixPortions({ grams: 480 }, Array.from({ length: 7 }, (_, i) => ing({ id: `i${i}` })));
    expect(p[0].qty).toBe(68.57);
  });
});

describe("mix: что можно класть", () => {
  it("упаковка нельзя", () => expect(mixable(ing({ id: "cup", category: "Упаковка", unit: "PC", pieceWeightG: 10 }))).toBe(false));
  it("штуки без веса нельзя, с весом можно", () => {
    expect(mixable(ing({ id: "lemon", unit: "PC" }))).toBe(false);
    expect(mixable(ing({ id: "lemon", unit: "PC", pieceWeightG: 90 }))).toBe(true);
  });
  it("граммы и миллилитры можно", () => {
    expect(mixable(ing({ id: "apple" }))).toBe(true);
    expect(mixable(ing({ id: "juice", unit: "ML" }))).toBe(true);
  });
});

describe("mix: запись в заказ", () => {
  const portions = mixPortions(size, [ing({ id: "apple", name: "Яблоко" }), ing({ id: "mango", name: "Манго", surcharge: 4000 })]);
  const mods = mixModifiers(size, portions);
  it("размер + ингредиенты с граммовкой", () => {
    expect(mods.map((m) => m.name)).toEqual(["400 мл", "Яблоко", "Манго"]);
  });
  it("склад списывает ингредиенты и стаканчик", () => {
    expect(mixNeedsFromModifiers(mods)).toEqual([{ ingredientId: "cup", qty: 1 }, { ingredientId: "apple", qty: 240 }, { ingredientId: "mango", qty: 240 }]);
  });
  it("обычные опции и мусор не дают расхода", () => {
    expect(mixNeedsFromModifiers([{ optionId: "o1", name: "Овсяное молоко" }, null, 5])).toEqual([]);
    expect(mixNeedsFromModifiers(undefined)).toEqual([]);
  });
  it("без стаканчика списываются только ингредиенты", () => {
    const m = mixModifiers({ ...size, cupIngredientId: null }, portions);
    expect(mixNeedsFromModifiers(m).map((x) => x.ingredientId)).toEqual(["apple", "mango"]);
  });
});

describe("mix: ключ корзины", () => {
  it("порядок и дубли не важны", () => {
    expect(mixKey({ sizeId: "s", ingredientIds: ["b", "a", "a"] })).toBe(mixKey({ sizeId: "s", ingredientIds: ["a", "b"] }));
  });
  it("размер меняет ключ", () => expect(mixKey({ sizeId: "s", ingredientIds: ["a"] })).not.toBe(mixKey({ sizeId: "t", ingredientIds: ["a"] })));
});
