import { describe, it, expect } from "vitest";
import { bigUnit, toBig, toBase, fmtQty, fmtStock, portionsFrom, smallLabel } from "@/lib/ingredient-units";

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
  it("shows stock in kg/l/pcs only, no grams", () => {
    expect(fmtStock("G", 850)).toBe("0,85 кг");
    expect(fmtStock("G", 2500)).toBe("2,5 кг");
    expect(fmtStock("G", 5)).toBe("0,005 кг");
    expect(fmtStock("ML", 1200)).toBe("1,2 л");
    expect(fmtStock("PC", 40)).toBe("40 шт");
    expect(fmtStock("KG", 3)).toBe("3 кг");
    expect(fmtStock("G", 0)).toBe("0 кг");
  });
  it("counts portions from stock", () => {
    expect(portionsFrom(5000, 30)).toBe(166);
    expect(portionsFrom(29, 30)).toBe(0);
    expect(portionsFrom(90, 30)).toBe(3);
    expect(portionsFrom(100, 0)).toBe(0);
    expect(portionsFrom(-5, 10)).toBe(0);
  });
});

import { conversionFactor } from "@/lib/ingredient-units";
describe("перевод единиц", () => {
  it("шт → г по весу штуки, г → шт обратно", () => {
    expect(conversionFactor("PC", "G", { perPiece: 150 })).toBe(150);
    expect(conversionFactor("G", "PC", { perPiece: 150 })).toBeCloseTo(1 / 150, 10);
    expect(() => conversionFactor("PC", "G")).toThrow(/штуке/);
  });
  it("вес и объём по плотности; одно семейство без параметров", () => {
    expect(conversionFactor("G", "ML")).toBe(1);
    expect(conversionFactor("G", "ML", { density: 1.2 })).toBeCloseTo(1.2, 10);
    expect(conversionFactor("ML", "G", { density: 2 })).toBe(0.5);
    expect(conversionFactor("G", "G")).toBe(1);
  });
  it("старые кг и л хранились крупно", () => {
    expect(conversionFactor("KG", "G")).toBe(1000);
    expect(conversionFactor("L", "ML")).toBe(1000);
    expect(conversionFactor("KG", "PC", { perPiece: 500 })).toBe(2);
  });
});
