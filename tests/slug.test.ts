import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("латиница", () => expect(slugify("Mango Smoothie")).toBe("mango-smoothie"));
  it("кириллица транслитерируется", () => {
    expect(slugify("Манго смузи")).toBe("mango-smuzi");
    expect(slugify("Клубничный коктейль")).not.toBe("product");
  });
  it("разные русские названия не совпадают", () => expect(slugify("Зелёный детокс")).not.toBe(slugify("Красный детокс")));
  it("узбекские буквы", () => expect(slugify("Қовун")).toMatch(/^[a-z0-9-]+$/));
  it("мусор не даёт пустой slug", () => expect(slugify("!!!")).toBe("product"));
  it("без двойных и краевых дефисов", () => expect(slugify("  --Fresh   Orange--  ")).toBe("fresh-orange"));
});
