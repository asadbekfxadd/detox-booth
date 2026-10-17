import { describe, it, expect } from "vitest";
import { parseReceiveList, findByName, type ListIngredient } from "@/lib/receive-list";

const L: ListIngredient[] = [
  { id: "a", name: "Клубника", unit: "G", avgCost: 60 },
  { id: "b", name: "Молоко", unit: "ML", avgCost: 12 },
  { id: "c", name: "Стакан 400 мл", unit: "PC", avgCost: 600 },
  { id: "d", name: "Апельсин", unit: "G", avgCost: 8 },
  { id: "e", name: "Апельсиновый сок", unit: "ML", avgCost: 15 },
];

describe("приход списком: разбор вставленного текста", () => {
  it("строка с тремя полями, цена за ту же единицу, что и количество", () => {
    const r = parseReceiveList("Клубника; 5 кг; 60000", L);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([{ ingredientId: "a", quantity: "5", unitCost: "60000", big: true, expiresAt: "" }]);
  });

  it("из Excel (табуляция), запятая в числе, пробел в тысячах", () => {
    const r = parseReceiveList("Молоко\t10,5 л\t12 000\t15.11.2026", L);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ ingredientId: "b", quantity: "10.5", unitCost: "12000", big: true, expiresAt: "2026-11-15" });
  });

  it("без единицы — базовая (граммы), без цены — прежняя средняя", () => {
    const r = parseReceiveList("Клубника; 2500", L);
    expect(r.rows[0]).toMatchObject({ quantity: "2500", unitCost: "60", big: false });
    const kg = parseReceiveList("Клубника; 2 кг", L);
    expect(kg.rows[0]).toMatchObject({ quantity: "2", unitCost: "60000", big: true });
  });

  it("штуки; кг для штучного ингредиента нельзя", () => {
    expect(parseReceiveList("Стакан; 500 шт; 600", L).rows[0]).toMatchObject({ ingredientId: "c", quantity: "500", big: false });
    expect(parseReceiveList("Стакан; 5 кг", L).errors[0]).toMatch(/Строка 1.*не в «кг»/);
  });

  it("название ищется без регистра и ё, по началу слова; точное совпадение важнее", () => {
    expect(findByName("клуб", L).ing?.id).toBe("a");
    expect(findByName("апельсин", L).ing?.id).toBe("d");
    expect(findByName("апельсино", L).ing?.id).toBe("e");
  });

  it("неоднозначное и неизвестное название — ошибка с номером строки", () => {
    const r = parseReceiveList("Клубника; 1 кг\nапель; 2 кг\nМанго; 3 кг", L);
    expect(r.rows).toHaveLength(1);
    expect(r.errors[0]).toMatch(/Строка 2.*несколько/);
    expect(r.errors[1]).toMatch(/Строка 3.*нет/);
    expect(r.failed).toEqual(["апель; 2 кг", "Манго; 3 кг"]);
  });

  it("плохие числа, единицы и даты", () => {
    expect(parseReceiveList("Клубника; много", L).errors[0]).toMatch(/не количество/);
    expect(parseReceiveList("Клубника; 0 кг", L).errors[0]).toMatch(/не количество/);
    expect(parseReceiveList("Клубника; 1 пуд", L).errors[0]).toMatch(/неизвестная единица/);
    expect(parseReceiveList("Клубника; 1 кг; abc", L).errors[0]).toMatch(/не цена/);
    expect(parseReceiveList("Клубника; 1 кг; 5; 31.02.2026", L).errors[0]).toMatch(/срок годности/);
    expect(parseReceiveList("Клубника", L).errors[0]).toMatch(/нужны название и количество/);
  });

  it("пустые строки пропускаются", () => {
    expect(parseReceiveList("\n\nКлубника; 1 кг\n\n", L).rows).toHaveLength(1);
  });

  it("неизвестный продукт с понятной единицей предлагается к созданию, без единицы или неоднозначный — нет", () => {
    const r = parseReceiveList("Манго; 3 кг\nманго; 2 кг\nСироп; 2 л\nСтаканчик; 500 шт\nПеченье; 5\nапель; 1 кг", L);
    expect(r.missing).toEqual([{ name: "Манго", unit: "G" }, { name: "Сироп", unit: "ML" }, { name: "Стаканчик", unit: "PC" }]);
    expect(r.rows).toHaveLength(0);
  });
});
