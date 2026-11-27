import { describe, it, expect } from "vitest";
import { parseSale, matchEntry, stem, type MatchProduct } from "@/lib/sale-parse";

const size = (id: string, opts: [string, number][]) => ({ id: `${id}-size`, name: "Объём", multiple: false, required: true, options: opts.map(([name, priceDelta], i) => ({ id: `${id}-s${i}`, name, priceDelta })) });
const milk = { id: "milk", name: "Молоко", multiple: false, required: false, options: [{ id: "milk-oat", name: "Овсяное", priceDelta: 5000 }, { id: "milk-coco", name: "Кокосовое", priceDelta: 6000 }] };
const juice = (id: string, name: string, price: number): MatchProduct => ({ id, name, price, modifiers: [size(id, [["300 мл", 0], ["500 мл", 10000]])] });
const P: MatchProduct[] = [
  juice("apple", "Яблочный сок", 25000),
  juice("orange", "Апельсиновый фреш", 30000),
  juice("carrot", "Морковный сок", 22000),
  juice("cac", "Морковь, яблоко, имбирь", 28000),
  { id: "latte", name: "Латте", price: 24000, modifiers: [size("latte", [["250 мл", 0], ["350 мл", 6000]]), milk] },
  { id: "capp", name: "Капучино", price: 22000, modifiers: [size("capp", [["250 мл", 0], ["350 мл", 6000]])] },
  { id: "amer", name: "Американо", price: 15000, modifiers: [] },
  { id: "smApple", name: "Смузи яблоко-банан", price: 32000, modifiers: [size("smApple", [["450 мл", 0]])] },
  { id: "smBerry", name: "Смузи ягодный", price: 34000, modifiers: [size("smBerry", [["450 мл", 0]])] },
];

describe("stem", () => {
  it("падежи совпадают", () => { expect(stem("яблочного")).toBe(stem("яблочный")); expect(stem("соки")).toBe(stem("сок")); });
});

describe("parseSale: одна позиция", () => {
  it("«яблочный сок» — один, 0.5 л по умолчанию (меньше не продаём), наличные", () => {
    const r = parseSale("яблочный сок", P);
    expect(r.errors).toEqual([]);
    expect(r.method).toBe("CASH");
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ productId: "apple", quantity: 1, optionIds: ["apple-s1"], unit: 35000 });
  });
  it("регистр, склонение, ё и знаки не мешают", () => {
    expect(parseSale("  Яблочного СОКА!  ", P).lines[0].productId).toBe("apple");
  });
  it("«сок яблочный» — порядок слов не важен", () => {
    expect(parseSale("сок яблочный", P).lines[0].productId).toBe("apple");
  });
  it("слово «яблоко» без «сок» — однозначно только если одно совпадение лучше", () => {
    const r = parseSale("яблоко", P);
    expect(r.lines.length + r.errors.length).toBe(1);
  });
  it("короткое «апельсин» находит фреш", () => {
    expect(parseSale("апельсин", P).lines[0].productId).toBe("orange");
  });
  it("неизвестное — ошибка unknown, ничего не угадываем", () => {
    const r = parseSale("пицца", P);
    expect(r.lines).toEqual([]);
    expect(r.errors[0]).toMatchObject({ reason: "unknown", raw: "пицца" });
  });
});

describe("parseSale: количество", () => {
  it.each([["2 латте"], ["латте 2"], ["два латте"], ["латте x2"], ["латте х2"], ["латте ×2"], ["латте *2"], ["х2 латте"], ["латте х 2"], ["2х латте"], ["латте 2 шт"], ["латте 2шт"], ["латте х2шт"]])("%s → 2", (t) => {
    expect(parseSale(t, P).lines[0]).toMatchObject({ productId: "latte", quantity: 2 });
  });
  it("«яблоко морковь х2» — две штуки одного сока, 0.5 л", () => {
    const r = parseSale("яблоко морковь х2", P);
    expect(r.errors).toEqual([]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ productId: "cac", quantity: 2, optionNames: ["500 мл"] });
  });
  it("«яблоко морковь х2 карта» и «яблоко морковь 2шт 0.5»", () => {
    expect(parseSale("яблоко морковь х2 карта", P)).toMatchObject({ method: "CARD", lines: [{ productId: "cac", quantity: 2 }] });
    expect(parseSale("яблоко морковь 2шт 0.5", P).lines[0]).toMatchObject({ productId: "cac", quantity: 2 });
  });
  it("два числа в одной позиции — ошибка", () => {
    expect(parseSale("2 3 латте", P).errors).toHaveLength(1);
  });
  it("одинаковые позиции складываются", () => {
    const r = parseSale("латте, латте, 2 латте", P);
    expect(r.lines).toHaveLength(1); expect(r.lines[0].quantity).toBe(4);
  });
});

describe("parseSale: объём", () => {
  it("«0.5» = 500 мл, доплата +10 000", () => {
    const l = parseSale("яблочный сок 0.5", P).lines[0];
    expect(l.optionIds).toEqual(["apple-s1"]); expect(l.unit).toBe(35000);
  });
  it.each([["яблочный сок 0,5"], ["яблочный сок 500"], ["яблочный сок 500 мл"], ["яблочный сок 500мл"], ["яблочный сок 0.5л"], ["яблочный сок 0.5 л"]])("%s → 500 мл", (t) => {
    expect(parseSale(t, P).lines[0].optionIds).toEqual(["apple-s1"]);
  });
  it("«2 яблочный сок 0.5» — количество и объём вместе", () => {
    expect(parseSale("2 яблочный сок 0.5", P).lines[0]).toMatchObject({ quantity: 2, optionIds: ["apple-s1"] });
  });
  it("нет такого объёма — ошибка size со списком доступных", () => {
    const r = parseSale("смузи ягодный 0.5", P);
    expect(r.lines).toEqual([]);
    expect(r.errors[0]).toMatchObject({ reason: "size", candidates: ["450 мл"] });
  });
  it("350 мл для латте", () => {
    expect(parseSale("латте 350", P).lines[0].optionIds).toContain("latte-s1");
  });
  it("кофе без размеров от 0.5 л берёт свой самый маленький", () => {
    expect(parseSale("латте", P).lines[0].optionIds).toContain("latte-s0");
  });
});

describe("parseSale: напитки от 0.5 л", () => {
  it("без объёма — 500 мл, с доплатой", () => {
    const l = parseSale("яблочный сок", P).lines[0];
    expect(l.optionNames).toEqual(["500 мл"]); expect(l.unit).toBe(35000);
  });
  it.each([["яблочный сок 0.3"], ["яблочный сок 300"], ["яблочный сок 300 мл"]])("%s — меньше 0.5 л не продаём", (t) => {
    const r = parseSale(t, P);
    expect(r.lines).toEqual([]);
    expect(r.errors[0]).toMatchObject({ reason: "size", candidates: ["500 мл"], ml: 300 });
  });
  it("1 литр, если такой размер есть", () => {
    const big: MatchProduct[] = [{ id: "j", name: "Яблочный фреш", price: 30000, modifiers: [size("j", [["500 мл", 0], ["1 л", 20000]])] }];
    expect(parseSale("яблочный фреш 1 л", big).lines[0]).toMatchObject({ optionIds: ["j-s1"], unit: 50000 });
    expect(parseSale("яблочный фреш", big).lines[0]).toMatchObject({ optionIds: ["j-s0"], unit: 30000 });
  });
});

describe("parseSale: опции", () => {
  it("«латте овсяное» добавляет молоко и доплату", () => {
    const l = parseSale("латте овсяное", P).lines[0];
    expect(l.optionNames).toEqual(["Овсяное", "250 мл"]); expect(l.unit).toBe(24000 + 5000);
  });
  it("лишнее слово, которого нет ни в названии, ни в опциях — ошибка", () => {
    expect(parseSale("латте с драконом", P).errors).toHaveLength(1);
  });
});

describe("parseSale: несколько позиций и оплата", () => {
  it("через запятую", () => {
    const r = parseSale("капучино, 3 американо", P);
    expect(r.errors).toEqual([]);
    expect(r.lines.map((l) => [l.productId, l.quantity])).toEqual([["capp", 1], ["amer", 3]]);
  });
  it("по строкам", () => {
    expect(parseSale("яблочный сок\n2 латте", P).lines.map((l) => l.productId)).toEqual(["apple", "latte"]);
  });
  it("«карта» меняет способ для всего сообщения и не мешает позициям", () => {
    const r = parseSale("2 латте карта", P);
    expect(r.method).toBe("CARD"); expect(r.lines[0]).toMatchObject({ productId: "latte", quantity: 2 }); expect(r.errors).toEqual([]);
  });
  it.each([["латте click", "ONLINE"], ["латте payme", "ONLINE"], ["латте онлайн", "ONLINE"], ["латте наличными", "CASH"], ["латте терминал", "CARD"], ["латте humo", "CARD"]])("%s → %s", (t, m) => {
    expect(parseSale(t, P).method).toBe(m);
  });
  it("название с запятыми целиком совпало — запятые не режем", () => {
    const r = parseSale("Морковь, яблоко, имбирь", P);
    expect(r.errors).toEqual([]);
    expect(r.lines).toHaveLength(1); expect(r.lines[0].productId).toBe("cac");
  });
  it("одна нераспознанная позиция — в errors, остальные всё равно разобраны (запись решает сервис)", () => {
    const r = parseSale("латте, пицца", P);
    expect(r.lines).toHaveLength(1); expect(r.errors).toHaveLength(1);
  });
  it("пустое сообщение", () => {
    expect(parseSale("   ", P)).toMatchObject({ lines: [], errors: [] });
  });
});

describe("matchEntry: неоднозначность", () => {
  it("«смузи» подходит двум — просит уточнить, а не выбирает", () => {
    const r = matchEntry("смузи", P);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.reason).toBe("ambiguous"); expect(r.error.candidates).toEqual(expect.arrayContaining(["Смузи ягодный", "Смузи яблоко-банан"])); }
  });
  it("«сок» подходит нескольким", () => {
    const r = matchEntry("сок", P);
    expect(r.ok).toBe(false);
  });
});
