import { describe, it, expect } from "vitest";
import { parseCoords, hasMap, yandexMapUrl, googleRouteUrl } from "@/lib/brand";

describe("координаты и карта", () => {
  it("разбирает координаты из карт", () => {
    expect(parseCoords("41.103801, 69.043818")).toEqual({ lat: 41.103801, lng: 69.043818 });
    expect(parseCoords("41,103801 69,043818")).toEqual({ lat: 41.103801, lng: 69.043818 });
    expect(parseCoords("  ")).toBeNull();
  });
  it("отклоняет мусор и значения вне диапазона", () => {
    expect(parseCoords("абв")).toBeUndefined();
    expect(parseCoords("95, 10")).toBeUndefined();
    expect(parseCoords("10, 190")).toBeUndefined();
  });
  it("карта нужна при координатах или точном адресе, но не при одном городе", () => {
    expect(hasMap({ address: "Ташкент" })).toBe(false);
    expect(hasMap({ address: null })).toBe(false);
    expect(hasMap({ address: "Ташкент, ул. Амира Темура, 15" })).toBe(true);
    expect(hasMap({ address: "Ташкент", lat: 41.1, lng: 69 })).toBe(true);
  });
  it("ссылки строятся по координатам, если они есть", () => {
    const p = { address: "Ташкент", lat: 41.103801, lng: 69.043818 };
    expect(yandexMapUrl(p)).toContain("pt=69.043818,41.103801");
    expect(googleRouteUrl(p)).toContain("41.103801%2C69.043818");
    expect(yandexMapUrl({ address: "Янгиюль, 10" })).toContain("text=");
  });
});
