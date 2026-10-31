import { describe, it, expect } from "vitest";
import { canLocateVisitor, nearestForVisitor } from "@/lib/site-locate";

const locs = [
  { id: "a", name: "Vitamin B Chilanzar", lat: 41.2755, lng: 69.2036 },
  { id: "b", name: "Vitamin B Graff", lat: 41.3111, lng: 69.2797 },
  { id: "c", name: "Без координат", lat: null, lng: null },
];

describe("ближайшая точка к посетителю", () => {
  it("рядом с точкой выбирает именно её", () => {
    expect(nearestForVisitor(locs, 41.2761, 69.2041)?.id).toBe("a");
    expect(nearestForVisitor(locs, 41.3105, 69.2790)?.id).toBe("b");
  });
  it("возвращает расстояние и подпись", () => {
    const n = nearestForVisitor(locs, 41.2761, 69.2041)!;
    expect(n.km).toBeGreaterThan(0); expect(n.km).toBeLessThan(0.5);
    expect(n.label).toMatch(/м$/);
  });
  it("точки без координат не участвуют", () => {
    expect(nearestForVisitor([locs[2]], 41.3, 69.2)).toBeNull();
  });
  it("дальше 40 км: другой город, предлагать нечего", () => {
    expect(nearestForVisitor(locs, 39.65, 66.96)).toBeNull(); // Самарканд
  });
  it("мусорные координаты отклоняются", () => {
    for (const [a, b] of [[NaN, 69], [41, Infinity], ["41", "69"], [0, 0], [95, 10], [41, 190], [null, null]]) expect(nearestForVisitor(locs, a, b)).toBeNull();
  });
  it("предлагать определение стоит, если точек больше одной и есть координаты", () => {
    expect(canLocateVisitor(locs)).toBe(true);
    expect(canLocateVisitor([locs[0]])).toBe(false);
    expect(canLocateVisitor([locs[2], { ...locs[2] }])).toBe(false);
    expect(canLocateVisitor([])).toBe(false);
  });
});
