import { describe, expect, it } from "vitest";
import { sameIngredient, alignQuantity, describeProduct, guessCategory, matchIngredient, normalizeText, parseDraft, scaleFor, scaleQty } from "@/lib/product-draft";

describe("parseDraft: свободный текст", () => {
  it("одна строка: название, состав, размеры и две цены", () => {
    const d = parseDraft("Яблочный фреш: яблоко 300 г, морковь 150 г, лимон 20 г. Размеры 300 и 500 мл, цена 25000 и 38000");
    expect(d.name).toBe("Яблочный фреш");
    expect(d.ingredients).toEqual([
      { name: "Яблоко", quantity: 300, unit: "G" }, { name: "Морковь", quantity: 150, unit: "G" }, { name: "Лимон", quantity: 20, unit: "G" },
    ]);
    expect(d.sizes).toEqual([{ name: "300 мл", ml: 300, price: 25000 }, { name: "500 мл", ml: 500, price: 38000 }]);
    expect(d.warnings).toEqual([]);
  });
  it("построчно, цена у каждого размера", () => {
    const d = parseDraft("Морковный фреш\nморковь 400 г\nапельсин 100 г\n300 мл — 25000\n500 мл — 38 000 сум");
    expect(d.name).toBe("Морковный фреш");
    expect(d.ingredients.map((i) => i.name)).toEqual(["Морковь", "Апельсин"]);
    expect(d.sizes).toEqual([{ name: "300 мл", ml: 300, price: 25000 }, { name: "500 мл", ml: 500, price: 38000 }]);
  });
  it("килограммы, литры, штуки и порядок «количество, потом название»", () => {
    const d = parseDraft("Смузи: 0,2 кг клубники, банан 1 шт, молоко 0,1 л, цена 30к");
    expect(d.ingredients).toEqual([
      { name: "Клубники", quantity: 200, unit: "G" }, { name: "Банан", quantity: 1, unit: "PC" }, { name: "Молоко", quantity: 100, unit: "ML" },
    ]);
    expect(d.sizes).toEqual([{ name: "Стандарт", ml: null, price: 30000 }]);
  });
  it("одна цена на несколько размеров считается пропорционально и предупреждает", () => {
    const d = parseDraft("Фреш: яблоко 200 г, размеры 250/500 мл, цена 20000");
    expect(d.sizes.map((s) => s.price)).toEqual([20000, 40000]);
    expect(d.warnings.join(" ")).toMatch(/пропорционально/);
  });
  it("единственный размер и без цены", () => {
    const d = parseDraft("Шот имбирный: имбирь 30 г, лимон 20 г, 60 мл");
    expect(d.sizes).toEqual([{ name: "60 мл", ml: 60, price: null }]);
  });
  it("слово «Размеры» не становится названием", () => {
    const d = parseDraft("Размеры 300 и 500 мл\nяблоко 300 г\nцена 25000, 38000");
    expect(d.name).toBe("");
    expect(d.sizes.map((s) => s.ml)).toEqual([300, 500]);
    expect(d.sizes.map((s) => s.price)).toEqual([25000, 38000]);
  });
  it("нераспознанное попадает в предупреждения, а не теряется молча", () => {
    const d = parseDraft("Фреш: яблоко 300 г, что-то 12 как-то");
    expect(d.ingredients).toHaveLength(1);
    expect(d.warnings.length).toBe(1);
  });
  it("тысячи с пробелом после «цена» и десятичные запятые", () => {
    expect(normalizeText("цена 25 000, 0,5 л")).toBe("цена 25000, 0.5 л");
    expect(parseDraft("Фреш: яблоко 300 г, 0,5 л, цена 25 000").sizes).toEqual([{ name: "500 мл", ml: 500, price: 25000 }]);
  });
});

describe("подбор ингредиентов склада", () => {
  const stock = [
    { id: "1", name: "Яблоко", unit: "G", pieceWeightG: 180 }, { id: "2", name: "Морковь", unit: "G", pieceWeightG: null },
    { id: "3", name: "Сок лимона", unit: "ML", pieceWeightG: null }, { id: "4", name: "Лимон", unit: "G", pieceWeightG: 90 }, { id: "5", name: "Стакан 400 мл", unit: "PC", pieceWeightG: null },
  ];
  it("падежи и формы", () => {
    expect(matchIngredient("Яблока", stock)?.id).toBe("1");
    expect(matchIngredient("моркови", stock)?.id).toBe("2");
    expect(matchIngredient("морковка", stock)?.id).toBe("2");
    expect(matchIngredient("сок лимона", stock)?.id).toBe("3");
    expect(matchIngredient("лимон", stock)?.id).toBe("4");
    expect(matchIngredient("манго", stock)).toBeNull();
    expect(sameIngredient("Яблока", "Яблоко")).toBe(true);
    expect(sameIngredient("морковка", "Морковь")).toBe(true);
    expect(sameIngredient("сок лимона", "Лимон")).toBe(false);
  });
  it("штуки в граммы по весу штуки, г и мл 1:1 с предупреждением, остальное в ноль", () => {
    expect(alignQuantity({ name: "Яблоко", quantity: 2, unit: "PC" }, "G", 180)).toEqual({ quantity: 360 });
    expect(alignQuantity({ name: "Сок", quantity: 50, unit: "G" }, "ML", null).warning).toMatch(/1 г = 1 мл/);
    expect(alignQuantity({ name: "Морковь", quantity: 2, unit: "PC" }, "G", null).quantity).toBe(0);
    expect(alignQuantity({ name: "Яблоко", quantity: 300, unit: "G" }, "G", null)).toEqual({ quantity: 300 });
  });
});

describe("размеры, категория, описание", () => {
  it("граммы пересчитываются по объёму от первого размера", () => {
    const sizes = [{ name: "250 мл", ml: 250, price: 1 }, { name: "500 мл", ml: 500, price: 2 }];
    expect(scaleFor(sizes, 0)).toBe(1);
    expect(scaleFor(sizes, 1)).toBe(2);
    expect(scaleQty(150, 2, "G")).toBe(300);
    expect(scaleQty(5, 1.5, "G")).toBe(7.5);
    expect(scaleFor([{ name: "Стандарт", ml: null, price: 1 }], 0)).toBe(1);
  });
  it("категория по названию", () => {
    const cats = [{ id: "a", name: "Смузи" }, { id: "b", name: "Фреши" }, { id: "c", name: "Салаты" }];
    expect(guessCategory("Яблочный фреш", cats)?.id).toBe("b");
    expect(guessCategory("Зелёный смузи", cats)?.id).toBe("a");
    expect(guessCategory("Что-то", cats)).toBeNull();
  });
  it("описание без выдуманных свойств", () => {
    const d = describeProduct("Яблочный фреш", ["Яблоко", "Морковь", "Стакан 400 мл"]);
    expect(d).toBe("Свежевыжатый фреш. Состав: яблоко, морковь. Готовим свежим по заказу.");
    expect(d).not.toMatch(/калор|веган|без сахара/i);
  });
});
