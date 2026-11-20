import { describe, it, expect } from "vitest";
import { saleDone, saleFailed, closed, summaryText, chooseLocation, staffHelp } from "@/lib/bot-sales-messages";

const nb = (s: string) => s.replace(/\u00a0/g, " ");
const line = { productId: "p", name: "Латте <b>", quantity: 2, optionIds: [], optionNames: ["Овсяное"], unit: 29000 };

describe("сообщения кассы в боте", () => {
  it("продажа: номер, позиции, итог, способ; названия экранируются", () => {
    const t = nb(saleDone({ number: 17, total: 58000, method: "CARD", lines: [line], discount: 0 }));
    expect(t).toContain("№17"); expect(t).toContain("2× Латте &lt;b&gt; (Овсяное)"); expect(t).toContain("58 000"); expect(t).toContain("картой"); expect(t).not.toContain("скидка");
  });
  it("скидка показывается", () => {
    expect(nb(saleDone({ number: 1, total: 1000, method: "CASH", lines: [line], discount: 500 }))).toContain("скидка 500");
  });
  it("ошибки: уточнение, объём, неизвестное, что поняли", () => {
    const t = saleFailed([{ raw: "смузи", reason: "ambiguous", candidates: ["А", "Б"] }, { raw: "кола", reason: "unknown" }, { raw: "чай 1", reason: "size", candidates: ["300 мл"] }], [line]);
    expect(t).toContain("А или Б"); expect(t).toContain("не нашёл"); expect(t).toContain("есть: 300 мл"); expect(t).toContain("Остальное понял"); expect(t).toContain("Ничего не записал");
  });
  it("закрытие смены: сходится и расхождение", () => {
    expect(closed(100000, 100000)).toContain("сходится");
    expect(nb(closed(100000, 90000))).toContain("−10 000");
    expect(nb(closed(100000, 120000))).toContain("+20 000");
  });
  it("итог без продаж и с продажами", () => {
    const base = { location: "Точка", since: new Date("2026-11-20T04:00:00Z"), count: 0, total: 0, cash: 0, card: 0, online: 0, refunds: 0, top: [] };
    expect(summaryText(base)).toContain("Продаж пока нет");
    expect(summaryText({ ...base, count: 3, total: 90000, cash: 60000, card: 30000, top: [{ name: "Латте", qty: 3 }] })).toContain("Латте: 3");
    expect(summaryText(base)).toContain("09:00");
  });
  it("выбор точки и справка", () => {
    expect(chooseLocation([{ name: "A" }, { name: "B" }])).toContain("2. B");
    expect(staffHelp).toContain("отмена");
  });
});
