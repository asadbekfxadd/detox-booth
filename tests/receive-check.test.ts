import { describe, it, expect } from "vitest";
import { receiveWarnings, type CheckRow } from "@/lib/receive-check";

const row = (o: Partial<CheckRow> = {}): CheckRow => ({ ingredientId: "a", unit: "кг", qty: 5, cost: 60000, lastCost: 60000, ...o });

describe("приход: проверки на опечатки", () => {
  it("нормальная строка без замечаний", () => expect(receiveWarnings([row()])).toEqual([[]]));
  it("пустые строки пропускаются", () => expect(receiveWarnings([null, row()])).toEqual([[], []]));
  it("слишком много: лишний ноль", () => {
    expect(receiveWarnings([row({ qty: 5000 })])[0][0]).toMatch(/очень много/);
    expect(receiveWarnings([row({ unit: "шт", qty: 500 })])[0]).toEqual([]);
    expect(receiveWarnings([row({ unit: "шт", qty: 30000 })])[0][0]).toMatch(/очень много/);
  });
  it("цена в разы выше или ниже прошлой", () => {
    expect(receiveWarnings([row({ cost: 600000 })])[0][0]).toMatch(/в 10 раз выше/);
    expect(receiveWarnings([row({ cost: 60 })])[0][0]).toMatch(/в 1\s000 раз ниже/);
  });
  it("заметное изменение цены — просто сообщение", () => {
    expect(receiveWarnings([row({ cost: 78000 })])[0][0]).toMatch(/Дороже.*30%/);
    expect(receiveWarnings([row({ cost: 42000 })])[0][0]).toMatch(/Дешевле.*30%/);
    expect(receiveWarnings([row({ cost: 63000 })])[0]).toEqual([]);
  });
  it("цена 0 и первая закупка без прошлой цены", () => {
    expect(receiveWarnings([row({ cost: 0 })])[0][0]).toMatch(/Цена 0/);
    expect(receiveWarnings([row({ lastCost: null })])[0]).toEqual([]);
    expect(receiveWarnings([row({ cost: null })])[0]).toEqual([]);
  });
  it("тот же продукт во второй строке", () => {
    const w = receiveWarnings([row(), row({ ingredientId: "b" }), row()]);
    expect(w[0]).toEqual([]);
    expect(w[2][0]).toMatch(/уже есть в строке 1/);
  });
});
