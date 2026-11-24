import { describe, it, expect } from "vitest";
import { pickerCommand, pickerKeyboard, pickerText, promptText, PAGE_SIZE, basketTotal, CB } from "@/lib/bot-purchase-ui";

const list = Array.from({ length: 40 }, (_, i) => ({ id: `id${i}`, name: `Ингредиент ${i + 1}` }));
const nb = (s: string) => s.replace(/ /g, " ");

describe("pickerCommand", () => {
  it.each(["закуп", "Закуп", "закупка", "приход", " Приход! ", "@vitamin_bot закуп"])("«%s» открывает список", (t) => {
    expect(pickerCommand(t)).toEqual({ locationNo: null });
  });
  it("номер точки", () => { expect(pickerCommand("закуп точка 2")).toEqual({ locationNo: 2 }); });
  it.each(["приход морковь 10 кг 5000", "закупили яблоки", "приходи завтра", "2 латте", ""])("«%s» — не команда списка", (t) => {
    expect(pickerCommand(t)).toBeUndefined();
  });
});

describe("клавиатура списка", () => {
  it("первая страница: 18 кнопок по 3 в ряд, навигация и «Записать»", () => {
    const k = pickerKeyboard(list, new Set(), 0, 0, 0).inline_keyboard;
    expect(k.slice(0, 6).every((r) => r.length === 3)).toBe(true);
    expect(k.slice(0, 6).flat()).toHaveLength(PAGE_SIZE);
    expect(k[6].map((b) => b.text)).toEqual(["◀", "1/3", "▶"]);
    expect(k[7].map((b) => b.callback_data)).toEqual([CB.ok, CB.cancel]);
  });
  it("последняя страница не выходит за границы, кнопка ▶ остаётся на ней", () => {
    const k = pickerKeyboard(list, new Set(), 99, 0, 0).inline_keyboard;
    expect(k.flat().some((b) => b.callback_data === "ap:i:id39")).toBe(true);
    expect(k.find((r) => r[0].text === "◀")![1].text).toBe("3/3");
  });
  it("отмеченные ✅, счётчик на «Записать»", () => {
    const k = pickerKeyboard(list, new Set(["id0"]), 0, 2, 420000).inline_keyboard;
    expect(k[0][0].text).toBe("✅ Ингредиент 1");
    expect(nb(k.at(-1)![0].text)).toBe("✅ Записать (2, 420 000 сум)");
  });
  it("короткий список без навигации; callback_data влезает в 64 байта для cuid", () => {
    const one = [{ id: "c".repeat(25), name: "Морковь" }];
    const k = pickerKeyboard(one, new Set(), 0, 0, 0).inline_keyboard;
    expect(k).toHaveLength(2);
    expect(Buffer.byteLength(k[0][0].callback_data)).toBeLessThanOrEqual(64);
  });
});

describe("тексты", () => {
  it("корзина и итог, имена экранируются", () => {
    const lines = [{ name: "Морковь <i>", unit: "KG" as const, quantity: 50, unitCost: 6000 }, { name: "Свекла", unit: "KG" as const, quantity: 20, unitCost: 6000 }];
    const t = nb(pickerText("Точка", lines));
    expect(t).toContain("Морковь &lt;i&gt;: 50 кг × 6 000 = 300 000"); expect(t).toContain("420 000 сум");
    expect(basketTotal(lines)).toBe(420000);
    expect(pickerText("Точка", [])).toContain("Корзина пуста");
  });
  it("вопрос про количество и цену называет единицу", () => {
    expect(promptText("Молоко", "L")).toContain("за 1 л");
    expect(promptText("Морковь", "KG")).toContain("за 1 кг");
  });
});
