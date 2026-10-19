import { describe, it, expect } from "vitest";
import { humanizeNotification, lowStockMessage, largeWriteOffMessage, varianceMessage } from "@/lib/notify";

describe("уведомления по-русски", () => {
  it("мало на складе: кг, минимум", () => {
    expect(lowStockMessage("Клубника", "G", 1500, 2000)).toBe("Мало на складе: Клубника — осталось 1,5 кг, минимум 2 кг");
  });
  it("остаток в минусе подсказывает про приход", () => {
    expect(lowStockMessage("Манго", "G", -125, 0)).toMatch(/осталось -0,125 кг.*не оформлен приход/);
  });
  it("старые английские записи переписываются при показе", () => {
    expect(humanizeNotification("LOW STOCK: Манго — -125 G (min 0)")).toMatch(/^Мало на складе: Манго — осталось/);
    expect(humanizeNotification("LOW STOCK: Молоко — 3000 ML (min 5000)")).toBe("Мало на складе: Молоко — осталось 3 л, минимум 5 л");
    expect(humanizeNotification("LARGE WRITE-OFF: Клубника 5000 G на 300000 UZS (SPOILED)")).toMatch(/^Крупное списание: Клубника, 5 кг на 300.000 UZS \(испортилось\)$/);
    expect(humanizeNotification("INVENTORY VARIANCE: Банан -250 G (-2000 UZS)")).toMatch(/^Расхождение при инвентаризации: Банан, -0,25 кг/);
  });
  it("русские и незнакомые тексты не трогаем", () => {
    expect(humanizeNotification("Заказ задержан")).toBe("Заказ задержан");
    expect(humanizeNotification("LOW STOCK: что-то странное")).toBe("LOW STOCK: что-то странное");
  });
  it("новые тексты", () => {
    expect(largeWriteOffMessage("Лимон", "G", 2000, 40000, "EXPIRED")).toContain("истёк срок");
    expect(varianceMessage("Лимон", "PC", 3, 900)).toContain("+3 шт");
  });
});
