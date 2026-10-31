import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { productSchema } from "@/services/products";
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
  it("ключи уникальны, ссылка: свой файл или Unsplash по https", () => {
    expect(new Set(DRINK_PHOTOS.map((p) => p.key)).size).toBe(DRINK_PHOTOS.length);
    for (const p of DRINK_PHOTOS) {
      expect(drinkPhotoUrl(p)).toMatch(p.file ? /^\/drinks\/[a-z0-9-]+\.jpg$/ : /^https:\/\/images\.unsplash\.com\/photo-\d+-[0-9a-f]+\?/);
      expect(p.label.length).toBeGreaterThan(3);
    }
  });
  it("свои снимки лежат в public/drinks", () => {
    const own = DRINK_PHOTOS.filter((p) => p.file);
    expect(own.length).toBe(11);
    for (const p of own) expect(existsSync(join(process.cwd(), "public", p.file!))).toBe(true);
  });
  it("карточка продукта принимает путь своего фото и ссылку, но не мусор", () => {
    const f = productSchema.shape.image;
    expect(f.safeParse("/drinks/carrot.jpg").success).toBe(true);
    expect(f.safeParse("https://images.unsplash.com/photo-1?w=900").success).toBe(true);
    expect(f.safeParse("").success).toBe(true);
    expect(f.safeParse("/etc/passwd").success).toBe(false);
    expect(f.safeParse("/drinks/../secret.jpg").success).toBe(false);
    expect(f.safeParse("не ссылка").success).toBe(false);
  });
  it("ключ из библиотеки находится, чужой нет", () => {
    expect(drinkPhotoByKey("orange")?.file).toBe("/drinks/orange.jpg");
    expect(drinkPhotoByKey("pineapple")?.id).toBeTruthy();
    expect(drinkPhotoByKey("http://evil.com/x.jpg")).toBeNull();
  });
  it("какие категории считаются напитками", () => {
    for (const [n, s] of [["Смузи", "smoothies"], ["Фреши и соки", "fresh"], ["Детокс", "detox"], ["Коктейли", "cocktails"], ["Напитки", "drinks"]]) expect(isDrinkCategory(n, s)).toBe(true);
    for (const [n, s] of [["Боулы", "bowls"], ["Салаты", "salads"], ["Сеты", "sets"], ["Перекусы", "healthy-snacks"]]) expect(isDrinkCategory(n, s)).toBe(false);
    expect(isSmoothieCategory("Смузи", "smoothies")).toBe(true);
    expect(isSmoothieCategory("Фреши и соки", "fresh")).toBe(false);
  });
});
