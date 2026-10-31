import { describe, it, expect } from "vitest";
import { buildTvPages, clampSec, nextSpot, TV_DEFAULT_SEC } from "@/lib/tv";
import { can, ROUTE_PERMISSIONS } from "@/lib/rbac";

const cats = [{ id: "c1", name: "Смузи", slug: "smoothies" }, { id: "c2", name: "Боулы", slug: "bowls" }, { id: "c3", name: "Пусто", slug: "empty" }];
const mk = (n: number, cat: string, over: Record<string, unknown> = {}) => ({
  id: `p${cat}${n}`, name: `Позиция ${n}`, description: null, image: null, defaultPrice: 10000 * n, oldDefaultPrice: null, happyPct: 0,
  volumeMl: null, calories: null, isVegan: false, isHighProtein: false, isSugarFree: false, available: true, comingSoon: false,
  category: { id: cat, slug: cat === "c1" ? "smoothies" : "bowls" }, ...over,
});

describe("страницы ТВ-меню", () => {
  it("только то, что можно заказать сейчас, пустые категории пропускаются", () => {
    const pages = buildTvPages([mk(1, "c1"), mk(2, "c1", { available: false }), mk(3, "c1", { comingSoon: true }), mk(1, "c2")], cats);
    expect(pages.map((p) => [p.category.slug, p.items.length])).toEqual([["smoothies", 1], ["bowls", 1]]);
  });
  it("порядок категорий как в меню", () => {
    expect(buildTvPages([mk(1, "c2"), mk(1, "c1")], cats).map((p) => p.category.id)).toEqual(["c1", "c2"]);
  });
  it("длинная категория делится поровну: 7 → 4 и 3, 6 → одна страница, 12 → 6 и 6", () => {
    const sizes = (n: number) => buildTvPages(Array.from({ length: n }, (_, i) => mk(i + 1, "c1")), cats).map((p) => p.items.length);
    expect(sizes(7)).toEqual([4, 3]); expect(sizes(6)).toEqual([6]); expect(sizes(12)).toEqual([6, 6]); expect(sizes(13)).toEqual([5, 4, 4]);
  });
  it("номера страниц и ключи", () => {
    const pages = buildTvPages(Array.from({ length: 8 }, (_, i) => mk(i + 1, "c1")), cats);
    expect(pages.map((p) => [p.pageNo, p.pageCount])).toEqual([[1, 2], [2, 2]]);
    expect(new Set(pages.map((p) => p.key)).size).toBe(2);
  });
  it("цена и скидка счастливых часов переносятся", () => {
    const [p] = buildTvPages([mk(3, "c1", { defaultPrice: 28000, oldDefaultPrice: 35000, happyPct: 20 })], cats);
    expect(p.items[0]).toMatchObject({ price: 28000, oldPrice: 35000, happyPct: 20 });
  });
  it("пустое меню даёт ноль страниц", () => expect(buildTvPages([], cats)).toEqual([]));
});

describe("порядок показа", () => {
  const pages = [{ items: [1, 2, 3] }, { items: [1, 2] }];
  it("идём по позициям, затем по страницам и по кругу", () => {
    let s: [number, number] = [0, 0]; const seen: string[] = [];
    for (let k = 0; k < 7; k++) { seen.push(s.join(":")); s = nextSpot(pages, s[0], s[1]); }
    expect(seen).toEqual(["0:0", "0:1", "0:2", "1:0", "1:1", "0:0", "0:1"]);
  });
  it("одна позиция, и пустой список не ломаются", () => {
    expect(nextSpot([{ items: [1] }], 0, 0)).toEqual([0, 0]);
    expect(nextSpot([], 3, 3)).toEqual([0, 0]);
  });
  it("скорость: по умолчанию 7, от 3 до 30", () => {
    expect(clampSec(undefined)).toBe(TV_DEFAULT_SEC); expect(clampSec("abc")).toBe(TV_DEFAULT_SEC); expect(clampSec("1")).toBe(TV_DEFAULT_SEC);
    expect(clampSec("10")).toBe(10); expect(clampSec("3")).toBe(3); expect(clampSec("999")).toBe(30);
  });
});

describe("доступ к настройке ТВ-меню", () => {
  it("страница в админке защищена правом на продукты", () => {
    expect(ROUTE_PERMISSIONS.find(([p]) => p === "/admin/tv")?.[1]).toBe("products.edit");
    expect(can("OWNER", "products.edit")).toBe(true);
    expect(can("CASHIER", "products.edit")).toBe(false);
  });
});
