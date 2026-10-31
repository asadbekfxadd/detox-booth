import { describe, it, expect } from "vitest";
import { buildTvGrid, buildTvPages, categoryWindow, clampGridSec, clampSec, gridShape, TV_GRID_DEFAULT_SEC, TV_GRID_PER_PAGE, nextSpot, onTone, TV_DEFAULT_SEC, TV_DEFAULT_TONE, tvTone } from "@/lib/tv";
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

describe("цвет экрана под напиток", () => {
  it("русские и английские названия", () => {
    expect(tvTone("Апельсиновый фреш")).toBe("#ff8a00"); expect(tvTone("Fresh Orange")).toBe("#ff8a00");
    expect(tvTone("Свёкла")).toBe("#e0204f"); expect(tvTone("Гранатовый фреш")).toBe("#e0204f");
    expect(tvTone("Green Detox")).toBe("#3fb34f"); expect(tvTone("Яблочный фреш")).toBe("#a6d12f");
    expect(tvTone("Манго-кокос")).toBe("#ffc400"); expect(tvTone("Морковный фреш")).toBe("#ff6a13");
  });
  it("сочетания берут более яркий цвет", () => {
    expect(tvTone("Клубника-банан")).toBe("#ff4264"); expect(tvTone("Банан и голубика")).toBe("#8a63ff");
    expect(tvTone("Яблоко и морковь")).toBe("#ff6a13"); expect(tvTone("Яблоко, шпинат")).toBe("#3fb34f");
  });
  it("неизвестное: тёплый жёлтый", () => expect(tvTone("Вода")).toBe(TV_DEFAULT_TONE));
  it("цвет текста: тёмный на светлом, белый на тёмном", () => {
    expect(onTone("#ffc400")).toBe("#1b1411"); expect(onTone("#ff8a00")).toBe("#1b1411"); expect(onTone("#f2dcaa")).toBe("#1b1411");
    expect(onTone("#8a63ff")).toBe("#ffffff"); expect(onTone("#e0204f")).toBe("#ffffff"); expect(onTone("кривой")).toBe("#1b1411");
  });
});

describe("категории в шапке", () => {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  it("мало категорий: все", () => expect(categoryWindow([1, 2, 3], 1)).toEqual({ items: [1, 2, 3], start: 0 }));
  it("окно из 6 вокруг текущей и не выходит за края", () => {
    expect(categoryWindow(a, 0).items).toEqual([0, 1, 2, 3, 4, 5]);
    expect(categoryWindow(a, 4).items).toEqual([1, 2, 3, 4, 5, 6]);
    expect(categoryWindow(a, 8).items).toEqual([3, 4, 5, 6, 7, 8]);
  });
});

describe("фото-меню (все позиции сразу)", () => {
  const many = (c: string, n: number) => Array.from({ length: n }, (_, i) => mk(i + 1, c));

  it("собирает категории подряд, поровну по страницам", () => {
    const g = buildTvGrid([...many("c1", 7), ...many("c2", 6)], cats);
    expect(g.map((p) => p.items.length)).toEqual([7, 6]);
    expect(g.map((p) => p.pageNo)).toEqual([1, 2]);
    expect(g.every((p) => p.pageCount === 2)).toBe(true);
    expect(g[0].items[0].categoryName).toBe("Смузи");
    expect(g[1].items[0].categoryName).toBe("Боулы");
  });

  it("13 позиций — две страницы 7+6, не 9+4; не больше 9 на экран", () => {
    const g = buildTvGrid(many("c1", 13), cats);
    expect(g.map((p) => p.items.length)).toEqual([7, 6]);
    expect(buildTvGrid(many("c1", 30), cats).every((p) => p.items.length <= TV_GRID_PER_PAGE)).toBe(true);
  });

  it("не показывает то, что нельзя заказать, и ничего не теряет", () => {
    const g = buildTvGrid([...many("c1", 3), mk(9, "c1", { available: false }), mk(8, "c2", { comingSoon: true })], cats);
    expect(g).toHaveLength(1);
    expect(g[0].items).toHaveLength(3);
    expect(buildTvGrid([], cats)).toEqual([]);
  });

  it("сетка: 1–3 колонки, ряды по числу карточек", () => {
    expect(gridShape(1)).toEqual({ cols: 1, rows: 1 });
    expect(gridShape(2)).toEqual({ cols: 2, rows: 1 });
    expect(gridShape(4)).toEqual({ cols: 2, rows: 2 });
    expect(gridShape(6)).toEqual({ cols: 3, rows: 2 });
    expect(gridShape(7)).toEqual({ cols: 3, rows: 3 });
    expect(gridShape(9)).toEqual({ cols: 3, rows: 3 });
    expect(gridShape(0)).toEqual({ cols: 1, rows: 1 });
  });

  it("время на страницу: 6–60 секунд, иначе 15", () => {
    expect(clampGridSec(undefined)).toBe(TV_GRID_DEFAULT_SEC);
    expect(clampGridSec("abc")).toBe(15);
    expect(clampGridSec("2")).toBe(15);
    expect(clampGridSec("20")).toBe(20);
    expect(clampGridSec("999")).toBe(60);
  });
});
