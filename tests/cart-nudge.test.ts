import { describe, it, expect } from "vitest";
import { NUDGE, QUIET_PATHS, canNudge, isReturning, nudgeCopy, tabTitle, type NudgeState } from "@/lib/cart-nudge";

const base: NudgeState = { now: 1_000_000, shown: 0, lastShownAt: null, snoozedUntil: null, cartCount: 2, quiet: false, visible: true, busy: false };

describe("canNudge", () => {
  it("можно, когда в корзине что-то есть и ничто не мешает", () => { expect(canNudge(base)).toBe(true); });
  it("не напоминает с пустой корзиной, на тихих страницах, в скрытой вкладке и когда Мандаринка занята", () => {
    expect(canNudge({ ...base, cartCount: 0 })).toBe(false);
    expect(canNudge({ ...base, quiet: true })).toBe(false);
    expect(canNudge({ ...base, visible: false })).toBe(false);
    expect(canNudge({ ...base, busy: true })).toBe(false);
  });
  it("не больше трёх раз за визит", () => {
    expect(canNudge({ ...base, shown: NUDGE.maxPerSession - 1 })).toBe(true);
    expect(canNudge({ ...base, shown: NUDGE.maxPerSession })).toBe(false);
  });
  it("между напоминаниями пауза", () => {
    expect(canNudge({ ...base, lastShownAt: base.now - NUDGE.minGapMs + 1000 })).toBe(false);
    expect(canNudge({ ...base, lastShownAt: base.now - NUDGE.minGapMs - 1000 })).toBe(true);
  });
  it("после «Позже» тишина на полчаса", () => {
    expect(canNudge({ ...base, snoozedUntil: base.now + 1000 })).toBe(false);
    expect(canNudge({ ...base, snoozedUntil: base.now - 1000 })).toBe(true);
  });
});

describe("страницы без напоминаний", () => {
  it("корзина, оформление, заказ, счёт стола, бронь", () => {
    for (const p of ["/cart", "/checkout", "/order/abc", "/table", "/book"]) expect(QUIET_PATHS.test(p)).toBe(true);
    for (const p of ["/", "/menu", "/menu/mango", "/promo", "/orders"]) expect(QUIET_PATHS.test(p)).toBe(false);
  });
});

describe("isReturning", () => {
  it("вернулся после долгого перерыва", () => {
    expect(isReturning(1000, 1000 + NUDGE.awayMs + 1)).toBe(true);
    expect(isReturning(1000, 1000 + NUDGE.awayMs - 1)).toBe(false);
    expect(isReturning(null, 5_000_000)).toBe(false);
  });
});

describe("nudgeCopy", () => {
  it("называет позиции и сумму", () => {
    const one = nudgeCopy("idle", "ru", { count: 1, names: ["Манго-кокос"], total: 34000 });
    expect(one.title).toBe("Вы ещё здесь?");
    expect(one.text).toContain("«Манго-кокос»");
    expect(one.text.replace(/\u00a0/g, " ")).toContain("34 000 сум");
    expect(nudgeCopy("idle", "ru", { count: 2, names: ["А", "Б"], total: 1000 }).text).toContain("«А» и «Б»");
    expect(nudgeCopy("idle", "ru", { count: 4, names: ["А", "Б", "В", "Г"], total: 1000 }).text).toContain("«А» и ещё 3");
  });
  it("без названий говорит числом позиций с правильным склонением", () => {
    expect(nudgeCopy("exit", "ru", { count: 1, names: [], total: null }).text).toContain("1 позиция");
    expect(nudgeCopy("exit", "ru", { count: 3, names: [], total: null }).text).toContain("3 позиции");
    expect(nudgeCopy("exit", "ru", { count: 11, names: [], total: null }).text).toContain("11 позиций");
    expect(nudgeCopy("exit", "ru", { count: 21, names: [], total: null }).text).toContain("21 позиция");
  });
  it("три повода — три разных заголовка; подсказка по акции добавляется", () => {
    const t = (["idle", "exit", "back"] as const).map((r) => nudgeCopy(r, "ru", { count: 1, names: ["А"], total: 1000, hint: "Добавьте ещё 1 шт. — бесплатно" }));
    expect(new Set(t.map((x) => x.title)).size).toBe(3);
    expect(t.every((x) => x.text.includes("Добавьте ещё 1 шт."))).toBe(true);
  });
  it("по-узбекски", () => {
    const x = nudgeCopy("back", "uz", { count: 2, names: ["A", "B"], total: 5000 });
    expect(x.title).toBe("Xush kelibsiz!");
    expect(x.text).toContain("so'm");
    expect(tabTitle("uz")).toContain("kutmoqda");
    expect(tabTitle("ru")).toContain("ждёт");
  });
});
