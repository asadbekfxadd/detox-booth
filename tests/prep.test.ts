import { describe, it, expect } from "vitest";
import { drinkColor, findIngredient, isChoppable, knownIngredients } from "@/lib/ingredients";
import { buildVideoPrompt } from "@/lib/video-prompt";

describe("ingredients", () => {
  it("узнаёт по корню слова в любой форме", () => {
    expect(findIngredient("Клубника")?.emoji).toBe("🍓");
    expect(findIngredient("клубничное пюре")?.en).toBe("strawberries");
    expect(findIngredient("Мёд цветочный")?.en).toBe("honey");
    expect(findIngredient("Стакан 300 мл")).toBeNull();
  });
  it("без повторов, не больше max и в порядке рецепта", () => {
    const k = knownIngredients(["Клубника", "Земляника", "Банан", "Манго", "Киви", "Лёд"], 3);
    expect(k.map((x) => x.en)).toEqual(["strawberries", "bananas", "mango"]);
  });
  it("неизвестные пропускаются", () => { expect(knownIngredients(["Крышка", "Соломинка"])).toEqual([]); });
});

describe("buildVideoPrompt", () => {
  const drink = buildVideoPrompt({ name: "Клубника-банан", categoryName: "Смузи", drink: true, ingredients: ["Клубника", "Банан", "Молоко", "Стакан"], volumeMl: 300 });
  it("напиток: вертикальное видео, английские ингредиенты, объём", () => {
    expect(drink).toContain("9:16");
    expect(drink).toContain("strawberries, bananas, milk");
    expect(drink).toContain("300 ml");
    expect(drink).toContain("blender");
    expect(drink).toContain("No text, no logos, no people");
  });
  it("не тащит русские названия упаковки", () => { expect(drink).not.toContain("Стакан"); });
  it("боул собирается руками без блендера", () => {
    const bowl = buildVideoPrompt({ name: "Боул с асаи", categoryName: "Боулы", drink: false, ingredients: ["Асаи", "Банан", "Гранола"], volumeMl: null });
    expect(bowl).toContain("bowl");
    expect(bowl).not.toContain("blender");
    expect(bowl).toContain("bananas, granola");
  });
  it("без узнанных ингредиентов не пустой", () => {
    expect(buildVideoPrompt({ name: "Х", categoryName: "Смузи", drink: true, ingredients: [], volumeMl: null })).toContain("fresh fruits and vegetables");
  });
});

describe("ингредиенты из обычного текста", () => {
  it("название «Клубника-банан» даёт два ингредиента по порядку", () => {
    expect(knownIngredients(["Клубника-банан"]).map((k) => k.en)).toEqual(["strawberries", "bananas"]);
  });
  it("название и описание вместе, без повторов", () => {
    expect(knownIngredients(["Манго-кокос", "Манго, кокосовое молоко и лёд"], 5).map((k) => k.en)).toEqual(["mango", "coconut", "milk", "ice cubes"]);
  });
});

describe("что рубят ножом", () => {
  it("фрукты и зелень рубят, лёд и молоко нет", () => {
    expect(isChoppable("🍊")).toBe(true);
    expect(isChoppable("🌿")).toBe(true);
    expect(isChoppable("🧊")).toBe(false);
    expect(isChoppable("🥛")).toBe(false);
  });
});

describe("цвет напитка", () => {
  it("один ингредиент даёт его цвет", () => {
    expect(drinkColor(knownIngredients(["Апельсин"]))).toBe("#ff9a1a");
  });
  it("клубника с бананом ближе к клубничному, но не совпадает с ним", () => {
    const c = drinkColor(knownIngredients(["Клубника-банан"]))!;
    const d = (x: string, y: string) => [1, 3, 5].reduce((sum, k) => sum + Math.abs(parseInt(x.slice(k, k + 2), 16) - parseInt(y.slice(k, k + 2), 16)), 0);
    expect(c).not.toBe("#ff5a6e");
    expect(d(c, "#ff5a6e")).toBeLessThan(d(c, "#f6dc8c"));
  });
  it("молоко почти не меняет цвет ягод", () => {
    const berries = drinkColor(knownIngredients(["Клубника"]))!, withMilk = drinkColor(knownIngredients(["Клубника", "Молоко"]))!;
    expect(parseInt(withMilk.slice(1, 3), 16)).toBeGreaterThan(220);
    expect(withMilk).not.toBe(berries);
  });
  it("лёд цвета не имеет, одни неизвестные дают null", () => {
    expect(drinkColor(knownIngredients(["Лёд"]))).toBeNull();
    expect(drinkColor([])).toBeNull();
  });
});
