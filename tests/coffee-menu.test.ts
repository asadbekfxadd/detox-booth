import { describe, expect, it } from "vitest";
import { COFFEE, COFFEE_INGREDIENTS, MILK_MODIFIER, SUGAR_MODIFIER } from "@/lib/coffee-menu";
import { mlOf } from "@/lib/recipe-size";
import { slugify } from "@/lib/slug";
import { productSchema } from "@/services/products";
import { matchIngredient } from "@/lib/product-draft";

describe("кофейное меню", () => {
  it("10 позиций, названия и ссылки на ингредиенты не повторяются", () => {
    expect(COFFEE).toHaveLength(10);
    expect(new Set(COFFEE.map((c) => c.name.toLowerCase())).size).toBe(10);
    expect(new Set(COFFEE.map((c) => slugify(c.name))).size).toBe(10);
    const keys = new Set(COFFEE_INGREDIENTS.map((i) => i.key));
    for (const c of COFFEE) for (const s of c.sizes) for (const i of s.items) expect(keys.has(i.ing)).toBe(true);
  });
  it("размеры: названия с объёмом, не повторяются, цены растут вместе с объёмом", () => {
    for (const c of COFFEE) {
      expect(c.sizes.length).toBeGreaterThan(0);
      const names = c.sizes.map((s) => s.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
      for (const s of c.sizes) { expect(mlOf(s.name), `${c.name}: ${s.name}`).not.toBeNull(); expect(s.items.length).toBeGreaterThan(0); }
      const sorted = [...c.sizes].sort((a, b) => (mlOf(a.name) ?? 0) - (mlOf(b.name) ?? 0));
      for (let i = 1; i < sorted.length; i++) expect(sorted[i].price).toBeGreaterThan(sorted[i - 1].price);
      expect(new Set(c.sizes.map((s) => s.price)).size).toBe(c.sizes.length);
    }
  });
  it("в рецепте один ингредиент не повторяется, количества положительные", () => {
    for (const c of COFFEE) for (const s of c.sizes) {
      expect(new Set(s.items.map((i) => i.ing)).size).toBe(s.items.length);
      for (const i of s.items) expect(i.qty).toBeGreaterThan(0);
    }
  });
  it("карточки проходят проверку продукта (цена, фото, описание)", () => {
    for (const c of COFFEE) {
      const r = productSchema.safeParse({ name: c.name, description: c.description, categoryId: "x", price: c.sizes[0].price, image: c.photo, prepMinutes: c.prep, allergens: c.allergens, isAvailable: true });
      expect(r.success, c.name).toBe(true);
    }
  });
  it("молочные напитки отмечены аллергеном и выбором молока", () => {
    for (const c of COFFEE) {
      const usesMilk = c.sizes.some((s) => s.items.some((i) => i.ing === "milk" || i.ing === "cream"));
      expect(c.allergens.includes("milk")).toBe(usesMilk);
      if (c.milk) expect(c.sizes.some((s) => s.items.some((i) => i.ing === "milk"))).toBe(true);
    }
    expect(MILK_MODIFIER.options[0][1]).toBe(0);
    expect(SUGAR_MODIFIER.options.every(([, d]) => d === 0)).toBe(true);
  });
  it("ингредиенты находятся на складе по привычным названиям", () => {
    const stock = [{ name: "Молоко 3.2%" }, { name: "Кофе зерно" }, { name: "Сливки 33%" }];
    expect(matchIngredient("Молоко", stock)?.name).toBe("Молоко 3.2%");
    expect(matchIngredient("Сливки", stock)?.name).toBe("Сливки 33%");
    expect(matchIngredient("Какао-порошок", stock)).toBeNull();
  });
});
