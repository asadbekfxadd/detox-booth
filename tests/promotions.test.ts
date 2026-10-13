import { describe, it, expect } from "vitest";
import { evaluate, inSchedule, scheduleText, describeRule, type PromoRule, type CartLine } from "@/lib/promotions";

const line = (productId: string, quantity: number, unitPrice: number, o: Partial<CartLine> = {}): CartLine => ({ productId, categoryId: "c1", quantity, unitPrice, happy: false, ...o });
const rule = (o: Partial<PromoRule> & Pick<PromoRule, "kind" | "config">): PromoRule => ({ id: "r" + Math.random().toString(36).slice(2, 6), name: "Акция", sort: 0, allowCode: false, withHappyHour: false, ...o });
const bogo = (buy = 2, free = 1, percent = 100, extra: Partial<PromoRule> = {}) => rule({ kind: "BUY_GET", name: "2+1", config: { productIds: [], categoryId: "c1", buy, free, percent }, labels: { target: "смузи" }, ...extra });

describe("купи N — получи", () => {
  it("2+1: три штуки, самая дешёвая бесплатно", () => {
    const r = evaluate([bogo()], [line("a", 1, 30000), line("b", 2, 20000)], { firstOrder: false });
    expect(r.discount).toBe(20000);
    expect(r.applied).toHaveLength(1);
  });
  it("шесть штук — две бесплатные, пять — одна", () => {
    expect(evaluate([bogo()], [line("a", 6, 10000)], { firstOrder: false }).discount).toBe(20000);
    expect(evaluate([bogo()], [line("a", 5, 10000)], { firstOrder: false }).discount).toBe(10000);
  });
  it("второй за полцены", () => {
    expect(evaluate([bogo(1, 1, 50)], [line("a", 2, 20000)], { firstOrder: false }).discount).toBe(10000);
  });
  it("в группе бесплатной считается самая дешёвая позиция", () => {
    const r = evaluate([bogo()], [line("a", 2, 50000), line("b", 1, 12000)], { firstOrder: false });
    expect(r.discount).toBe(12000);
  });
  it("чужая категория не участвует", () => {
    expect(evaluate([bogo()], [line("a", 3, 10000, { categoryId: "c2" })], { firstOrder: false }).discount).toBe(0);
  });
  it("на конкретный продукт", () => {
    const r = rule({ kind: "BUY_GET", config: { productIds: ["a"], categoryId: null, buy: 1, free: 1, percent: 100 } });
    expect(evaluate([r], [line("a", 2, 9000), line("b", 2, 9000)], { firstOrder: false }).discount).toBe(9000);
  });
  it("позиции со счастливыми часами пропускаются, если не разрешено", () => {
    expect(evaluate([bogo()], [line("a", 3, 10000, { happy: true })], { firstOrder: false }).discount).toBe(0);
    expect(evaluate([bogo(2, 1, 100, { withHappyHour: true })], [line("a", 3, 10000, { happy: true })], { firstOrder: false }).discount).toBe(10000);
  });
  it("подсказка, сколько добавить", () => {
    const r = evaluate([bogo()], [line("a", 2, 10000)], { firstOrder: false });
    expect(r.discount).toBe(0);
    expect(r.hints[0].text).toBe("Добавьте ещё 1 шт. «смузи» — одна бесплатно");
    expect(evaluate([bogo()], [line("a", 1, 10000)], { firstOrder: false }).hints[0].text).toContain("ещё 2 шт.");
    expect(evaluate([bogo()], [line("a", 3, 10000)], { firstOrder: false }).hints).toHaveLength(0);
  });
});

describe("набор по фиксированной цене", () => {
  const set = rule({ kind: "COMBO", name: "Обед", config: { items: [{ productId: "bowl", qty: 1 }, { productId: "juice", qty: 1 }], price: 45000 }, labels: { items: { bowl: "Боул", juice: "Фреш" } } });
  it("скидка равна разнице с суммой позиций", () => {
    const r = evaluate([set], [line("bowl", 1, 38000), line("juice", 1, 22000)], { firstOrder: false });
    expect(r.discount).toBe(15000);
  });
  it("два набора", () => {
    expect(evaluate([set], [line("bowl", 2, 38000), line("juice", 2, 22000)], { firstOrder: false }).discount).toBe(30000);
  });
  it("лишняя позиция остаётся по полной цене", () => {
    expect(evaluate([set], [line("bowl", 2, 38000), line("juice", 1, 22000)], { firstOrder: false }).discount).toBe(15000);
  });
  it("набор дороже суммы позиций скидку не даёт", () => {
    expect(evaluate([set], [line("bowl", 1, 20000), line("juice", 1, 20000)], { firstOrder: false }).discount).toBe(0);
  });
  it("подсказка, чего не хватает", () => {
    const r = evaluate([set], [line("bowl", 1, 38000)], { firstOrder: false });
    expect(r.hints[0].text).toContain("«Фреш»");
    expect(r.hints[0].text).toContain("45 000 сум");
  });
  it("набор с количеством 2", () => {
    const s2 = rule({ kind: "COMBO", config: { items: [{ productId: "juice", qty: 2 }], price: 30000 } });
    expect(evaluate([s2], [line("juice", 5, 20000)], { firstOrder: false }).discount).toBe(20000);
  });
});

describe("скидка от суммы и первый заказ", () => {
  const tiers = rule({ kind: "THRESHOLD", name: "Ступени", config: { tiers: [{ from: 100000, percent: 5 }, { from: 200000, percent: 10 }, { from: 300000, off: 50000 }] } });
  it("берётся подходящая ступень", () => {
    expect(evaluate([tiers], [line("a", 1, 99000)], { firstOrder: false }).discount).toBe(0);
    expect(evaluate([tiers], [line("a", 1, 100000)], { firstOrder: false }).discount).toBe(5000);
    expect(evaluate([tiers], [line("a", 1, 250000)], { firstOrder: false }).discount).toBe(25000);
    expect(evaluate([tiers], [line("a", 1, 320000)], { firstOrder: false }).discount).toBe(50000);
  });
  it("подсказка про следующую ступень", () => {
    const r = evaluate([tiers], [line("a", 1, 180000)], { firstOrder: false });
    expect(r.hints[0].text).toBe("Добавьте ещё 20 000 сум — скидка 10%");
  });
  it("считается от суммы после акций на позиции", () => {
    const r = evaluate([bogo(), tiers], [line("a", 3, 70000)], { firstOrder: false });
    // 210 000 − 70 000 = 140 000, ступень 5% = 7 000
    expect(r.discount).toBe(77000);
    expect(r.applied).toHaveLength(2);
  });
  it("первый заказ", () => {
    const f = rule({ kind: "FIRST_ORDER", name: "Первый", config: { percent: 15, maxOff: 20000 } });
    expect(evaluate([f], [line("a", 1, 100000)], { firstOrder: true }).discount).toBe(15000);
    expect(evaluate([f], [line("a", 1, 200000)], { firstOrder: true }).discount).toBe(20000);
    expect(evaluate([f], [line("a", 1, 100000)], { firstOrder: false }).discount).toBe(0);
    const unknown = evaluate([f], [line("a", 1, 100000)], { firstOrder: null });
    expect(unknown.discount).toBe(0);
    expect(unknown.hints[0].text).toContain("телефон");
  });
  it("из акций на сумму берётся одна, самая выгодная", () => {
    const f = rule({ kind: "FIRST_ORDER", name: "Первый", config: { percent: 20, maxOff: null } });
    const r = evaluate([tiers, f], [line("a", 1, 100000)], { firstOrder: true });
    expect(r.applied.map((x) => x.name)).toEqual(["Первый"]);
    expect(r.discount).toBe(20000);
  });
});

describe("общие правила", () => {
  it("скидка не больше суммы заказа", () => {
    const t = rule({ kind: "THRESHOLD", config: { tiers: [{ from: 1, off: 999999 }] } });
    expect(evaluate([t], [line("a", 1, 10000)], { firstOrder: false }).discount).toBe(10000);
  });
  it("порядок задаётся полем sort, штука участвует только в одной акции", () => {
    const a = bogo(2, 1, 100, { sort: 2, name: "Б" });
    const b = rule({ kind: "BUY_GET", name: "А", sort: 1, config: { productIds: [], categoryId: "c1", buy: 1, free: 1, percent: 50 } });
    const r = evaluate([a, b], [line("x", 3, 10000)], { firstOrder: false });
    // А (sort 1) берёт пару: 5000; Б остаётся с одной штукой — не срабатывает
    expect(r.discount).toBe(5000);
    expect(r.applied[0].name).toBe("А");
  });
  it("пустая корзина и без акций", () => {
    expect(evaluate([], [line("a", 1, 100)], { firstOrder: false })).toEqual({ discount: 0, applied: [], hints: [] });
    expect(evaluate([bogo()], [], { firstOrder: false }).discount).toBe(0);
  });
});

describe("расписание и описание", () => {
  const at = (iso: string) => Date.parse(iso); // 2026-10-13 вторник
  it("дни и часы по Ташкенту", () => {
    const s = { days: [2], startMin: 12 * 60, endMin: 15 * 60, startsAt: null, endsAt: null };
    expect(inSchedule(s, at("2026-10-13T08:00:00Z"))).toBe(true); // 13:00 Ташкент
    expect(inSchedule(s, at("2026-10-13T10:00:00Z"))).toBe(false); // 15:00
    expect(inSchedule(s, at("2026-10-14T08:00:00Z"))).toBe(false); // среда
  });
  it("даты начала и конца", () => {
    const s = { days: [], startMin: 0, endMin: 1440, startsAt: new Date("2026-10-10T00:00:00+05:00"), endsAt: new Date("2026-10-20T23:59:59+05:00") };
    expect(inSchedule(s, at("2026-10-13T08:00:00Z"))).toBe(true);
    expect(inSchedule(s, at("2026-10-21T08:00:00Z"))).toBe(false);
    expect(inSchedule(s, at("2026-10-09T08:00:00Z"))).toBe(false);
  });
  it("тексты", () => {
    expect(scheduleText({ days: [1, 2, 3, 4, 5], startMin: 720, endMin: 900, startsAt: null, endsAt: null })).toBe("Пн, Вт, Ср, Чт, Пт, 12:00–15:00");
    expect(scheduleText({ days: [], startMin: 0, endMin: 1440, startsAt: null, endsAt: null })).toBe("");
    expect(describeRule({ kind: "BUY_GET", config: { productIds: [], categoryId: "c", buy: 2, free: 1, percent: 100 }, labels: { target: "смузи" } })).toBe("Купите 2 шт. (смузи) — ещё одна бесплатно");
    expect(describeRule({ kind: "FIRST_ORDER", config: { percent: 10, maxOff: null } })).toBe("Скидка 10% на первый заказ");
  });
});

describe("весь день", () => {
  it("с 00:00 до 23:59 считается целым днём и не выводится в тексте", () => {
    const s = { days: [], startMin: 0, endMin: 1439, startsAt: null, endsAt: null };
    expect(scheduleText(s)).toBe("");
    expect(inSchedule(s, Date.parse("2026-10-13T18:59:30Z"))).toBe(true); // 23:59:30 по Ташкенту
  });
});
