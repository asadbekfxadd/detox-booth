import { describe, it, expect } from "vitest";
import { bigUnit, toBig, toBase, fmtQty, portionsFrom, smallLabel } from "@/lib/ingredient-units";

describe("ingredient units", () => {
  it("converts kg <-> g and l <-> ml", () => {
    expect(toBase("G", 2.5)).toBe(2500);
    expect(toBig("G", 2500)).toBe(2.5);
    expect(toBase("ML", 1.5)).toBe(1500);
    expect(toBase("PC", 40)).toBe(40);
  });
  it("legacy kg/l units are not rescaled", () => {
    expect(bigUnit("KG").factor).toBe(1);
    expect(toBase("KG", 3)).toBe(3);
    expect(smallLabel("KG")).toBe("кг");
  });
  it("formats stock for people", () => {
    expect(fmtQty("G", 850)).toBe("850 г");
    expect(fmtQty("G", 2500)).toBe("2,5 кг");
    expect(fmtQty("ML", 1200)).toBe("1,2 л");
    expect(fmtQty("PC", 40)).toBe("40 шт");
    expect(fmtQty("G", 0)).toBe("0 г");
  });
  it("counts portions from stock", () => {
    expect(portionsFrom(5000, 30)).toBe(166);
    expect(portionsFrom(29, 30)).toBe(0);
    expect(portionsFrom(90, 30)).toBe(3);
    expect(portionsFrom(100, 0)).toBe(0);
    expect(portionsFrom(-5, 10)).toBe(0);
  });
});
