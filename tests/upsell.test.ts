import { describe, it, expect } from "vitest";
import { buildAdvice, bridgePicks, deliveryGap, isDrink, MIN_PAIR_ORDERS, type MenuLite, type PairStat, type UpsellPick } from "@/lib/upsell";
import type { Hint } from "@/lib/promotions";

const item = (id: string, categorySlug: string, price: number, o: Partial<MenuLite> = {}): MenuLite => ({
  id, slug: id, name: `Позиция ${id}`, image: null, categoryId: `cat-${categorySlug}`, categorySlug, categoryName: categorySlug,
  price, optionIds: [], needsChoice: false, available: true, ...o,
});
const MENU: MenuLite[] = [
  item("mango", "smoothies", 34000, { name: "Манго-кокос", categoryName: "Смузи" }),
  item("berry", "smoothies", 32000, { name: "Ягодный", categoryName: "Смузи" }),
  item("orange", "fresh", 28000, { categoryName: "Фреши" }),
  item("bowl", "bowls", 58000, { categoryName: "Боулы" }),
  item("salad", "salads", 42000, { categoryName: "Салаты" }),
  item("bar", "healthy-snacks", 15000, { categoryName: "Перекусы" }),
  item("shot", "detox", 14000, { categoryName: "Детокс-шоты" }),
];
const noPairs = new Map<string, PairStat>();
const cart = (...ids: string[]) => ids.map((productId) => ({ productId, quantity: 1 }));
const ids = (ps: UpsellPick[]) => ps.map((p) => p.id);

describe("isDrink", () => {
  it("узнаёт напитки по названию или slug категории", () => {
    expect(isDrink({ categorySlug: "smoothies", categoryName: "Смузи" })).toBe(true);
    expect(isDrink({ categorySlug: "x", categoryName: "Детокс-шоты" })).toBe(true);
    expect(isDrink({ categorySlug: "bowls", categoryName: "Боулы" })).toBe(false);
    expect(isDrink({ categorySlug: "healthy-snacks", categoryName: "Перекусы" })).toBe(false);
  });
});

describe("совет Мандаринки", () => {
  it("«с этим берут» — только при достаточном числе настоящих заказов", () => {
    const weak = new Map<string, PairStat>([["bar", { anchorId: "mango", orders: MIN_PAIR_ORDERS - 1, total: 5 }]]);
    expect(buildAdvice({ cart: cart("mango"), menu: MENU, pairs: weak, popular: null, hints: [], subtotal: 34000 }).advice?.kind).not.toBe("pair");
    const ok = new Map<string, PairStat>([["bar", { anchorId: "mango", orders: MIN_PAIR_ORDERS, total: 5 }]]);
    const r = buildAdvice({ cart: cart("mango"), menu: MENU, pairs: ok, popular: null, hints: [], subtotal: 34000 });
    expect(r.advice?.kind).toBe("pair");
    expect(r.advice?.text).toContain("«Манго-кокос»");
    expect(ids(r.advice!.picks)).toEqual(["bar"]);
  });
  it("пары ранжируются по связи, а не по популярности: редкая, но стойкая пара выше хита", () => {
    const pairs = new Map<string, PairStat>([
      ["bowl", { anchorId: "mango", orders: 10, total: 100 }], // 1.0
      ["bar", { anchorId: "mango", orders: 5, total: 6 }],     // ~2.04
    ]);
    const r = buildAdvice({ cart: cart("mango"), menu: MENU, pairs, popular: null, hints: [], subtotal: 34000 });
    expect(ids(r.advice!.picks).slice(0, 2)).toEqual(["bar", "bowl"]);
  });
  it("в корзине одни напитки — предлагает еду; одна еда — напиток", () => {
    const drinks = buildAdvice({ cart: cart("mango", "orange"), menu: MENU, pairs: noPairs, popular: null, hints: [], subtotal: 62000 });
    expect(drinks.advice?.kind).toBe("missing");
    expect(drinks.advice!.picks.every((p) => !isDrink(p))).toBe(true);
    const food = buildAdvice({ cart: cart("bowl"), menu: MENU, pairs: noPairs, popular: null, hints: [], subtotal: 58000 });
    expect(food.advice?.kind).toBe("missing");
    expect(food.advice!.picks.every((p) => isDrink(p))).toBe(true);
  });
  it("напиток и еда уже есть — берём хиты, если продажи были", () => {
    const r = buildAdvice({ cart: cart("mango", "bowl"), menu: MENU, pairs: noPairs, popular: ["salad", "bar"], hints: [], subtotal: 92000 });
    expect(r.advice?.kind).toBe("popular");
    expect(ids(r.advice!.picks)).toEqual(["salad", "bar"]);
  });
  it("нет ни пар, ни продаж, ни пробела в корзине — совета нет, но companions есть", () => {
    const r = buildAdvice({ cart: cart("mango", "bowl"), menu: MENU, pairs: noPairs, popular: null, hints: [], subtotal: 92000 });
    expect(r.advice).toBeNull();
    expect(r.companions.length).toBeGreaterThan(0);
  });
  it("не предлагает то, что уже в корзине, и то, чего нет в наличии", () => {
    const menu = MENU.map((p) => (p.id === "bar" ? { ...p, available: false } : p));
    const r = buildAdvice({ cart: cart("mango"), menu, pairs: noPairs, popular: ["bar", "mango", "bowl"], hints: [], subtotal: 34000 });
    expect(ids(r.companions)).not.toContain("mango");
    expect(ids(r.companions)).not.toContain("bar");
  });

  it("акция почти сработала: предлагает позицию из корзины первой", () => {
    const hint: Hint = { id: "p1", name: "2+1", text: "Добавьте ещё 1 шт. «Смузи» — одна бесплатно", fill: { type: "items", need: 1, productIds: [], categoryId: "cat-smoothies" } };
    const r = buildAdvice({ cart: [{ productId: "berry", quantity: 2 }], menu: MENU, pairs: noPairs, popular: null, hints: [hint], subtotal: 64000 });
    expect(r.advice?.kind).toBe("promo");
    expect(r.advice?.hintId).toBe("p1");
    expect(ids(r.advice!.picks)[0]).toBe("berry");
    expect(r.advice!.picks.every((p) => p.categorySlug === "smoothies")).toBe(true);
    expect(r.advice!.text.startsWith("Почти!")).toBe(true);
  });
  it("акция важнее обычных советов, даже если есть пары", () => {
    const pairs = new Map<string, PairStat>([["bar", { anchorId: "berry", orders: 9, total: 9 }]]);
    const hint: Hint = { id: "p1", name: "2+1", text: "x", fill: { type: "items", need: 1, productIds: ["berry"], categoryId: null } };
    expect(buildAdvice({ cart: cart("berry"), menu: MENU, pairs, popular: null, hints: [hint], subtotal: 32000 }).advice?.kind).toBe("promo");
  });

  it("до скидки: полоса и позиции, которые закрывают разрыв", () => {
    const hint: Hint = { id: "t1", name: "От суммы", text: "Добавьте ещё 40 000 сум — скидка 10%", fill: { type: "amount", left: 40000, target: 100000, base: 60000 } };
    const r = buildAdvice({ cart: cart("bowl"), menu: MENU, pairs: noPairs, popular: null, hints: [hint], subtotal: 60000 });
    expect(r.advice?.kind).toBe("threshold");
    expect(r.advice?.progress).toEqual({ current: 60000, target: 100000, left: 40000 });
    expect(ids(r.advice!.picks)).toEqual(["salad"]);
    expect(r.advice?.text.startsWith("Добавьте")).toBe(true);
  });
  it("«совсем чуть-чуть», когда осталось меньше трети порога", () => {
    const hint: Hint = { id: "t1", name: "x", text: "Добавьте ещё 10 000 сум — скидка 10%", fill: { type: "amount", left: 10000, target: 100000, base: 90000 } };
    expect(buildAdvice({ cart: cart("bowl"), menu: MENU, pairs: noPairs, popular: null, hints: [hint], subtotal: 90000 }).advice?.text.startsWith("Совсем чуть-чуть!")).toBe(true);
  });
  it("далёкая цель не показывается как совет (меньше 40% порога)", () => {
    const hint: Hint = { id: "t1", name: "x", text: "Добавьте ещё 180 000 сум — скидка", fill: { type: "amount", left: 180000, target: 200000, base: 20000 } };
    expect(buildAdvice({ cart: cart("shot"), menu: MENU, pairs: noPairs, popular: null, hints: [hint], subtotal: 20000 }).advice?.kind).not.toBe("threshold");
  });
});

describe("bridgePicks", () => {
  const p = (id: string, price: number): UpsellPick => ({ id, slug: id, name: id, image: null, categorySlug: "x", categoryName: "x", price, optionIds: [], needsChoice: false });
  it("берёт позиции, закрывающие разрыв и не слишком его превышающие", () => {
    const ranked = [p("cheap", 5000), p("fit", 22000), p("huge", 90000), p("fit2", 25000)];
    expect(ids(bridgePicks(ranked, 20000))).toEqual(["fit", "fit2"]);
  });
  it("quickOnly: позиции, требующие выбора варианта, пропускаются", () => {
    const ranked = [{ ...p("pick", 25000), needsChoice: true }, p("quick", 24000)];
    expect(ids(bridgePicks(ranked, 20000, 2, true))).toEqual(["quick"]);
    expect(ids(bridgePicks([{ ...p("only", 25000), needsChoice: true }], 20000, 2, true))).toEqual(["only"]);
  });
  it("если ни одна не закрывает разрыв, берёт лучшие по рейтингу", () => {
    expect(ids(bridgePicks([p("a", 3000), p("b", 4000), p("c", 5000), p("d", 6000)], 30000))).toEqual(["a", "b", "c"]);
  });
});

describe("deliveryGap", () => {
  it("сколько осталось до бесплатной доставки", () => {
    expect(deliveryGap({ fee: 12000, freeFrom: 100000 }, 70000)).toEqual({ left: 30000, target: 100000, save: 12000 });
  });
  it("нечего показывать: порог достигнут, нет порога, доставка и так бесплатная", () => {
    expect(deliveryGap({ fee: 12000, freeFrom: 100000 }, 100000)).toBeNull();
    expect(deliveryGap({ fee: 12000, freeFrom: null }, 10)).toBeNull();
    expect(deliveryGap({ fee: 0, freeFrom: 100000 }, 10)).toBeNull();
  });
});

describe("исключения", () => {
  it("позиции корзины с проблемой не предлагаются повторно", () => {
    const r = buildAdvice({ cart: cart("bowl"), menu: MENU, pairs: noPairs, popular: ["orange", "salad"], hints: [], subtotal: 58000, exclude: ["orange"] });
    expect(ids(r.companions)).not.toContain("orange");
  });
});
