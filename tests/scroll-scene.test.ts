import { describe, it, expect } from "vitest";
import { clamp, smooth, trackProgress, photoWeight, textOpacity, nearestIndex } from "@/lib/scroll-scene";

describe("trackProgress", () => {
  it("фото идут на отрезке A, затем держится последнее и идёт финал", () => {
    // секция 5000, сцена 1000, финал 1000 → A = 3000
    expect(trackProgress(0, 5000, 1000, 1000)).toEqual({ progress: 0, finale: 0 });
    expect(trackProgress(1500, 5000, 1000, 1000)).toEqual({ progress: 0.5, finale: 0 });
    expect(trackProgress(3500, 5000, 1000, 1000)).toEqual({ progress: 1, finale: 0.5 });
    expect(trackProgress(99999, 5000, 1000, 1000)).toEqual({ progress: 1, finale: 1 });
    expect(trackProgress(-300, 5000, 1000, 1000)).toEqual({ progress: 0, finale: 0 });
  });
  it("телефон: финала нет", () => {
    expect(trackProgress(2000, 4000, 1000, 0)).toEqual({ progress: 2 / 3, finale: 0 });
    expect(trackProgress(9000, 4000, 1000, 0).finale).toBe(0);
  });
  it("вырожденная высота не даёт NaN", () => {
    const t = trackProgress(10, 100, 100, 0);
    expect(Number.isFinite(t.progress)).toBe(true);
  });
});

describe("photoWeight", () => {
  it("сумма весов всегда 1, на целых позициях виден ровно один кадр", () => {
    for (const n of [2, 3, 5, 9]) for (let k = 0; k <= 100; k++) {
      const p = k / 100;
      const sum = Array.from({ length: n }, (_, i) => photoWeight(p, i, n)).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
    expect(photoWeight(0, 0, 3)).toBe(1); expect(photoWeight(0, 1, 3)).toBe(0);
    expect(photoWeight(0.5, 1, 3)).toBe(1); expect(photoWeight(1, 2, 3)).toBe(1);
    expect(photoWeight(0.25, 0, 3)).toBeCloseTo(0.5); expect(photoWeight(0.25, 1, 3)).toBeCloseTo(0.5);
  });
  it("одно фото всегда видно; прогресс вне 0…1 не ломает", () => {
    expect(photoWeight(0.7, 0, 1)).toBe(1);
    expect(photoWeight(-5, 0, 3)).toBe(1); expect(photoWeight(9, 2, 3)).toBe(1);
  });
});

describe("подписи", () => {
  it("textOpacity: на месте 1, далеко 0, плавно между", () => {
    expect(textOpacity(0)).toBe(1); expect(textOpacity(0.2)).toBe(1);
    expect(textOpacity(0.7)).toBe(0); expect(textOpacity(-0.7)).toBe(0);
    expect(textOpacity(0.42)).toBeCloseTo(0.5, 5); expect(textOpacity(-0.42)).toBeCloseTo(0.5, 5);
  });
  it("nearestIndex выбирает ближайший к верху", () => {
    expect(nearestIndex([10, 1125, 2250])).toBe(0);
    expect(nearestIndex([-600, 400, 1500])).toBe(1);
    expect(nearestIndex([-2000, -900, -50])).toBe(2);
  });
  it("clamp и smooth", () => {
    expect(clamp(2)).toBe(1); expect(clamp(-1)).toBe(0);
    expect(smooth(0, 1, 0.5)).toBe(0.5); expect(smooth(0.2, 0.4, 0.1)).toBe(0); expect(smooth(0.2, 0.4, 0.9)).toBe(1);
  });
});
