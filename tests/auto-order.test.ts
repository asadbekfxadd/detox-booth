import { describe, it, expect } from "vitest";
import { suggestQty, roundUpTo, orderStep, orderText } from "@/lib/auto-order";

const base = { stock: 0, onOrder: 0, min: 0, max: 0, avgDaily: 0, coverDays: 7, leadDays: 2, unit: "G" };

describe("автозаказ", () => {
  it("ниже минимума: заказываем до максимума", () => {
    const s = suggestQty({ ...base, stock: 3000, min: 5000, max: 20000 });
    expect(s.qty).toBe(17000);
    expect(s.reason).toBe("below_min");
  });
  it("выше минимума ничего не заказываем", () => {
    expect(suggestQty({ ...base, stock: 6000, min: 5000, max: 20000 }).qty).toBe(0);
  });
  it("уже заказанное учитывается: второй раз то же не предлагаем", () => {
    expect(suggestQty({ ...base, stock: 3000, onOrder: 17000, min: 5000, max: 20000 }).qty).toBe(0);
    expect(suggestQty({ ...base, stock: 3000, onOrder: 5000, min: 5000, max: 20000 }).qty).toBe(0); // 3 + 5 = 8 кг, выше минимума
    expect(suggestQty({ ...base, stock: 3000, onOrder: 1000, min: 5000, max: 20000 }).qty).toBe(16000); // заказываем только недостающее
  });
  it("быстрый расход: хватит меньше чем на срок доставки, заказываем на N дней вперёд", () => {
    // 4 кг в день, на складе 6 кг (хватит на 1,5 дня), везут 2 дня; запас на 7 дней = 28 кг
    const s = suggestQty({ ...base, stock: 6000, min: 2000, max: 8000, avgDaily: 4000 });
    expect(s.reason).toBe("runs_out");
    expect(s.daysLeft).toBe(1.5);
    expect(s.qty).toBe(22000); // 28 000 − 6 000
  });
  it("без минимума и без продаж заказывать нечего", () => {
    expect(suggestQty({ ...base, stock: 0 }).qty).toBe(0);
  });
  it("округляет вверх: граммы по 100, штуки целыми", () => {
    expect(roundUpTo(1234, orderStep("G"))).toBe(1300);
    expect(suggestQty({ ...base, unit: "PC", stock: 10, min: 50, max: 200, avgDaily: 0 }).qty).toBe(190);
    expect(roundUpTo(250.2, orderStep("PC"))).toBe(251);
  });
  it("текст заказа для мессенджера", () => {
    const t = orderText({ supplier: "Фрукты", location: "Chilonzor", lines: [{ name: "Orange", qty: "25 кг" }] });
    expect(t).toContain("«Chilonzor»");
    expect(t).toContain("• Orange: 25 кг");
  });
});
