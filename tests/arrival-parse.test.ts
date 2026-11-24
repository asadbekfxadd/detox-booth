import { describe, it, expect } from "vitest";
import { parseArrival, isArrivalText, amount, type MatchIngredient } from "@/lib/arrival-parse";

const ING: MatchIngredient[] = [
  { id: "carrot", name: "Морковь", unit: "KG", avgCost: 5000 },
  { id: "beet", name: "Свекла", unit: "KG", avgCost: 5000 },
  { id: "ginger", name: "Имбирь", unit: "KG", avgCost: 28000 },
  { id: "pumpkin", name: "Тыква", unit: "KG", avgCost: 3000 },
  { id: "greens", name: "Зелень", unit: "KG", avgCost: 14000 },
  { id: "apple", name: "Яблоко", unit: "KG", avgCost: 8000 },
  { id: "applegreen", name: "Яблоко зелёное", unit: "KG", avgCost: 9000 },
  { id: "sugar", name: "Сахар", unit: "G", avgCost: 12 },
  { id: "cup", name: "Стакан 300 мл", unit: "PC", avgCost: 800 },
  { id: "milk", name: "Молоко", unit: "L", avgCost: 11000 },
];
const MSG = `Морковка 50 кг 6000 сум
Свекла 20кг 6000 сум
Имбирь 30.000 сум кг
Тыква 33кг по 3000 кг
Зелень 15000
Общий: 564.000 сум`;
const by = (r: ReturnType<typeof parseArrival>) => Object.fromEntries(r.lines.map((l) => [l.ingredientId, l]));

describe("amount", () => {
  it("деньги: точка — тысячи", () => { expect(amount("30.000", "money")).toBe(30000); expect(amount("564.000", "money")).toBe(564000); expect(amount("1.250.000", "money")).toBe(1250000); });
  it("количество: 1.500 кг — это 1,5", () => { expect(amount("1.500", "qty")).toBe(1.5); expect(amount("2,5", "qty")).toBe(2.5); expect(amount("1.250.000", "qty")).toBe(1250000); });
});

describe("isArrivalText", () => {
  it("слово «приход» или строка «Общий»", () => {
    expect(isArrivalText("Приход морковь 10 кг 5000")).toBe(true);
    expect(isArrivalText("закупка: яблоко 5 кг")).toBe(true);
    expect(isArrivalText(MSG)).toBe(true);
  });
  it("обычная продажа — нет", () => {
    expect(isArrivalText("2 латте карта")).toBe(false);
    expect(isArrivalText("яблочный сок 0.5")).toBe(false);
    expect(isArrivalText("приходи завтра")).toBe(false);
  });
});

describe("parseArrival: сообщение владельца", () => {
  const r = parseArrival(MSG, ING);
  it("все 5 строк найдены, итог сходится", () => {
    expect(r.errors).toEqual([]); expect(r.mismatch).toBe(false);
    expect(r.lines).toHaveLength(5); expect(r.sum).toBe(564000); expect(r.claimedTotal).toBe(564000);
  });
  it("количество и цена за кг", () => {
    const m = by(r);
    expect(m.carrot).toMatchObject({ quantity: 50, unitCost: 6000, total: 300000 });
    expect(m.beet).toMatchObject({ quantity: 20, unitCost: 6000, total: 120000 });
    expect(m.ginger).toMatchObject({ quantity: 1, unitCost: 30000, total: 30000 });
    expect(m.pumpkin).toMatchObject({ quantity: 33, unitCost: 3000, total: 99000 });
    expect(m.greens).toMatchObject({ quantity: 1, unitCost: 15000, total: 15000 });
  });
});

describe("parseArrival: общий случай", () => {
  it("«приход» в первой строке и позиция в ней же", () => {
    const r = parseArrival("Приход морковь 10 кг 5000\nсвекла 5 кг 4000", ING);
    expect(r.errors).toEqual([]); expect(r.lines.map((l) => l.ingredientId)).toEqual(["carrot", "beet"]); expect(r.sum).toBe(70000);
  });
  it("без «Общий» сверки нет, mismatch=false", () => {
    const r = parseArrival("приход\nморковь 10 кг 5000", ING);
    expect(r.claimedTotal).toBeNull(); expect(r.mismatch).toBe(false);
  });
  it("«Общий» не сходится — mismatch, суммы видны", () => {
    const r = parseArrival("морковь 10 кг 5000\nИтого: 60.000", ING);
    expect(r.mismatch).toBe(true); expect(r.sum).toBe(50000); expect(r.claimedTotal).toBe(60000);
  });
  it("цена «за всю строку» принимается, если с ней сходится общий итог", () => {
    const r = parseArrival("морковь 10 кг 50000 сум\nсвекла 5 кг 20000 сум\nОбщий: 70.000", ING);
    expect(r.mismatch).toBe(false); expect(r.sum).toBe(70000);
    expect(by(r).carrot).toMatchObject({ quantity: 10, unitCost: 5000, total: 50000 });
  });
  it("цена не указана — средняя цена ингредиента, помечено", () => {
    const l = parseArrival("морковь 10 кг", ING).lines[0];
    expect(l).toMatchObject({ quantity: 10, unitCost: 5000, guessedPrice: true });
  });
  it("кг → граммы: количество и цена пересчитываются в единицу склада", () => {
    const l = parseArrival("сахар 2 кг 12000 сум", ING).lines[0];
    expect(l).toMatchObject({ unit: "G", quantity: 2000, unitCost: 12, total: 24000 });
  });
  it("литры и штуки", () => {
    const r = parseArrival("молоко 20 л 11000\nстакан 1000 шт 700", ING);
    expect(r.errors).toEqual([]);
    expect(by(r).milk).toMatchObject({ quantity: 20, unitCost: 11000 });
    expect(by(r).cup).toMatchObject({ quantity: 1000, unitCost: 700 });
  });
  it("дробное количество 1.5 кг", () => {
    expect(parseArrival("имбирь 1.5 кг 30000", ING).lines[0]).toMatchObject({ quantity: 1.5, total: 45000 });
  });
  it("два числа без единиц: количество, потом цена", () => {
    expect(parseArrival("морковь 50 6000", ING).lines[0]).toMatchObject({ quantity: 50, unitCost: 6000 });
  });
  it("одинаковый ингредиент в двух строках складывается", () => {
    const l = parseArrival("морковь 10 кг 5000\nморковь 10 кг 7000", ING).lines;
    expect(l).toHaveLength(1); expect(l[0]).toMatchObject({ quantity: 20, unitCost: 6000, total: 120000 });
  });
});

describe("parseArrival: ошибки", () => {
  it("неизвестное и неоднозначное", () => {
    const r = parseArrival("кола 5 кг 3000\nяблоко 5 кг 8000", ING);
    expect(r.errors.find((e) => e.raw.startsWith("кола"))).toMatchObject({ reason: "unknown" });
    // «яблоко» точно совпадает с «Яблоко», а не с «Яблоко зелёное»
    expect(r.lines.map((l) => l.ingredientId)).toEqual(["apple"]);
  });
  it("«зелёное яблоко» — не путает с обычным", () => {
    expect(parseArrival("яблоко зеленое 5 кг 9000", ING).lines[0].ingredientId).toBe("applegreen");
  });
  it("несовместимая единица: стакан в кг", () => {
    expect(parseArrival("стакан 5 кг 1000", ING).errors[0]).toMatchObject({ reason: "unit" });
  });
  it("непонятная строка (несколько цен)", () => {
    expect(parseArrival("морковь 5 кг 6000 сум 7000 сум", ING).errors[0]).toMatchObject({ reason: "unclear" });
  });
  it("«точка N» вырезается и запоминается", () => {
    const r = parseArrival("приход точка 2\nморковь 10 кг 5000", ING);
    expect(r.locationNo).toBe(2); expect(r.errors).toEqual([]); expect(r.lines).toHaveLength(1);
  });
  it("пусто", () => {
    expect(parseArrival("приход", ING)).toMatchObject({ lines: [], errors: [] });
  });
});
