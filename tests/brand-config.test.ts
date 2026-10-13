import { describe, it, expect } from "vitest";
import { BLANK_BRAND, DEFAULT_BRAND, withNameChange, pageTitle, parseBrand, brandFromStored, brandPalette, paletteCss, parseInstagram, safeImageUrl, splitName, BrandError } from "@/lib/brand-config";
import { contrast } from "@/lib/color";

const ok = { ...DEFAULT_BRAND, ticker: DEFAULT_BRAND.ticker.join("\n"), assistant: "on" };

describe("brand config", () => {
  it("default brand round-trips and keeps Vitamin B styles untouched", () => {
    const b = parseBrand(ok);
    expect(b.name).toBe("Vitamin B");
    expect(b.assistant).toBe(true);
    expect(brandPalette(b)).toBeNull();
    expect(paletteCss(null)).toBe("");
  });
  it("requires a name and valid colors", () => {
    expect(() => parseBrand({ ...ok, name: "  " })).toThrow(BrandError);
    expect(() => parseBrand({ ...ok, primary: "green" })).toThrow(/Основной цвет/);
    expect(() => parseBrand({ ...ok, accent: "#12" })).toThrow(/Акцентный/);
  });
  it("rejects unreadable colors", () => {
    expect(() => parseBrand({ ...ok, primary: "#f5f5a0" })).toThrow(/слишком светлый/);
    expect(() => parseBrand({ ...ok, accent: "#101010" })).toThrow(/слишком тёмный/);
  });
  it("builds a readable palette for a custom brand", () => {
    const b = parseBrand({ ...ok, name: "Osh Markazi", primary: "#7a1f1f", accent: "#f4b400" });
    const p = brandPalette(b)!;
    expect(p["--color-forest"]).toBe("#7a1f1f");
    expect(contrast(p["--color-orange-deep"], p["--color-cream"])).toBeGreaterThanOrEqual(4.5);
    expect(paletteCss(p)).toMatch(/^:root\{--color-forest:#7a1f1f;/);
  });
  it("accepts only safe image links", () => {
    expect(safeImageUrl("")).toBe("");
    expect(safeImageUrl("/brand/logo.png")).toBe("/brand/logo.png");
    expect(safeImageUrl("https://cdn.example.com/a.png")).toContain("https://cdn.example.com/a.png");
    expect(() => safeImageUrl("javascript:alert(1)")).toThrow(BrandError);
    expect(() => safeImageUrl("//evil.com/x.png")).toThrow(BrandError);
    expect(() => safeImageUrl("http://insecure.example.com/x.png")).toThrow(BrandError);
    expect(() => safeImageUrl("data:image/png;base64,AAAA")).toThrow(BrandError);
  });
  it("normalizes instagram handles", () => {
    expect(parseInstagram("@osh.markazi")).toBe("osh.markazi");
    expect(parseInstagram("https://www.instagram.com/osh.markazi/?hl=ru")).toBe("osh.markazi");
    expect(parseInstagram("")).toBe("");
    expect(() => parseInstagram("не ник")).toThrow(BrandError);
  });
  it("limits the ticker and drops empty lines", () => {
    const b = parseBrand({ ...ok, ticker: "a\n\n b \n" + Array.from({ length: 20 }, (_, i) => `x${i}`).join("\n") });
    expect(b.ticker.length).toBe(10);
    expect(b.ticker.slice(0, 2)).toEqual(["a", "b"]);
  });
  it("falls back to defaults on broken stored data", () => {
    expect(brandFromStored(null)).toEqual(DEFAULT_BRAND);
    expect(brandFromStored({ name: "", primary: "x" })).toEqual(DEFAULT_BRAND);
    expect(brandFromStored({ name: "Cafe Nur", primary: "#123456", accent: "#ffcc00" }).name).toBe("Cafe Nur");
  });
  it("splits the name for the accented last word", () => {
    expect(splitName("Vitamin B")).toEqual(["Vitamin", "B"]);
    expect(splitName("Osh")).toEqual(["Osh", ""]);
  });
  it("drops a stale page title when only the name changed", () => {
    const next = parseBrand({ ...ok, name: "Osh Markazi", descriptor: "плов и самса" });
    const merged = withNameChange(next, DEFAULT_BRAND);
    expect(merged.seoTitle).toBe("");
    expect(pageTitle(merged)).toBe("Osh Markazi — плов и самса");
    const kept = withNameChange(parseBrand({ ...ok, name: "Osh Markazi", seoTitle: "Лучший плов в Ташкенте" }), DEFAULT_BRAND);
    expect(pageTitle(kept)).toBe("Лучший плов в Ташкенте");
    expect(pageTitle(DEFAULT_BRAND)).toBe("Vitamin B — fresh juice bar: соки, смузи и фреши");
  });
  it("blank brand for a new venue is valid and has no Vitamin B traces", () => {
    const b = parseBrand({ ...BLANK_BRAND, ticker: "" });
    expect(b.homeStyle).toBe("classic");
    expect(b.assistant).toBe(false);
    expect(JSON.stringify(b)).not.toMatch(/vitamin/i);
    expect(brandPalette(b)).not.toBeNull();
    expect(brandFromStored(null, BLANK_BRAND)).toEqual(BLANK_BRAND);
    expect(brandFromStored({ name: "Cafe Nur" }, BLANK_BRAND).homeStyle).toBe("classic");
  });
});
