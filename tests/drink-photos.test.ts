import { describe, it, expect } from "vitest";
import { DRINK_PHOTOS, drinkPhotoByKey, drinkPhotoUrl, isDrinkCategory, isSmoothieCategory, pickDrinkPhoto } from "@/lib/drink-photos";

const key = (name: string, smoothie = false) => pickDrinkPhoto(name, smoothie).photo.key;

describe("подбор фото напитка по названию", () => {
  it("названия из меню Vitamin B", () => {
    expect(key("Апельсиновый фреш")).toBe("orange");
    expect(key("Апельсин яблоко")).toBe("orange-pitcher");
    expect(key("банан голубика")).toBe("blueberry");
    expect(key("морковный фреш")).toBe("carrot");
    expect(key("свекла")).toBe("beet");
    expect(key("Яблоко Морковь")).toBe("carrot-apple");
    expect(key("Гранатовый фреш")).toBe("pomegranate");
    expect(key("Яблочный фреш")).toBe("apple");
    expect(key("Грин детокс")).toBe("green");
    expect(key("Банан-овсянка")).toBe("banana");
  });
  it("регистр и буква ё не важны", () => {
    expect(key("СВЁКЛА")).toBe("beet");
    expect(key("Свёкла с яблоком")).toBe("beet");
    expect(key("Морковь, яблоко, имбирь")).toBe("carrot-apple");
  });
  it("тропики, ягоды, лимонад", () => {
    expect(key("Манго-кокос")).toBe("mango-coconut");
    expect(key("Клубника-банан")).toBe("strawberry");
    expect(key("Лимонад мята-лайм")).toBe("lemonade");
    expect(key("Ананас")).toBe("pineapple");
    expect(key("Арбузный микс")).toBe("watermelon");
    expect(key("Киви-шпинат")).toBe("kiwi");
  });
  it("нет совпадения: общее фото, для смузи своё", () => {
    expect(pickDrinkPhoto("Марс")).toMatchObject({ kind: "fallback", photo: { key: "juices" } });
    expect(pickDrinkPhoto("Марс", true)).toMatchObject({ kind: "fallback", photo: { key: "smoothies" } });
    expect(pickDrinkPhoto("Апельсиновый фреш").kind).toBe("match");
  });
});

describe("библиотека фото", () => {
  it("ключи уникальны, ссылки только на Unsplash по https", () => {
    expect(new Set(DRINK_PHOTOS.map((p) => p.key)).size).toBe(DRINK_PHOTOS.length);
    for (const p of DRINK_PHOTOS) {
      expect(drinkPhotoUrl(p)).toMatch(/^https:\/\/images\.unsplash\.com\/photo-\d+-[0-9a-f]+\?/);
      expect(p.label.length).toBeGreaterThan(3);
    }
  });
  it("ключ из библиотеки находится, чужой нет", () => {
    expect(drinkPhotoByKey("orange")?.id).toBeTruthy();
    expect(drinkPhotoByKey("http://evil.com/x.jpg")).toBeNull();
  });
  it("какие категории считаются напитками", () => {
    for (const [n, s] of [["Смузи", "smoothies"], ["Фреши и соки", "fresh"], ["Детокс", "detox"], ["Коктейли", "cocktails"], ["Напитки", "drinks"]]) expect(isDrinkCategory(n, s)).toBe(true);
    for (const [n, s] of [["Боулы", "bowls"], ["Салаты", "salads"], ["Сеты", "sets"], ["Перекусы", "healthy-snacks"]]) expect(isDrinkCategory(n, s)).toBe(false);
    expect(isSmoothieCategory("Смузи", "smoothies")).toBe(true);
    expect(isSmoothieCategory("Фреши и соки", "fresh")).toBe(false);
  });
});
