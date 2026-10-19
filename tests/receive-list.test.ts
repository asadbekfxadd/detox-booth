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
  it("строка с тремя полями: количество в кг, цена за 1 кг", () => {
    const r = parseReceiveList("Клубника; 5 кг; 60000", L);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([{ ingredientId: "a", quantity: "5", unitCost: "60000", expiresAt: "" }]);
  });

  it("из Excel (табуляция), запятая в числе, пробел в тысячах", () => {
    const r = parseReceiveList("Молоко\t10,5 л\t12 000\t15.11.2026", L);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ ingredientId: "b", quantity: "10.5", unitCost: "12000", expiresAt: "2026-11-15" });
  });

  it("без единицы — кг/л/шт, без цены — с прошлой закупки, а если её не было, то средняя", () => {
    const r = parseReceiveList("Клубника; 2,5", L);
    expect(r.rows[0]).toMatchObject({ quantity: "2.5", unitCost: "60000" });
    const withLast = parseReceiveList("Клубника; 2 кг", [{ ...L[0], lastCost: 65 }]);
    expect(withLast.rows[0]).toMatchObject({ quantity: "2", unitCost: "65000" });
    expect(parseReceiveList("Молоко; 3", L).rows[0]).toMatchObject({ quantity: "3", unitCost: "12000" });
    expect(parseReceiveList("Стакан; 100", L).rows[0]).toMatchObject({ quantity: "100", unitCost: "600" });
  });

  it("граммы и мл понимаем и пересчитываем в кг и л, цена остаётся за кг/л", () => {
    expect(parseReceiveList("Клубника; 500 г; 60000", L).rows[0]).toMatchObject({ quantity: "0.5", unitCost: "60000" });
    expect(parseReceiveList("Молоко; 250 мл", L).rows[0]).toMatchObject({ quantity: "0.25", unitCost: "12000" });
  });

  it("старые ингредиенты в кг и л не пересчитываются", () => {
    const old: ListIngredient[] = [{ id: "k", name: "Соль", unit: "KG", avgCost: 3000 }];
    expect(parseReceiveList("Соль; 2 кг", old).rows[0]).toMatchObject({ quantity: "2", unitCost: "3000" });
    expect(parseReceiveList("Соль; 500 г", old).rows[0]).toMatchObject({ quantity: "0.5" });
  });

  it("штуки; кг для штучного ингредиента нельзя", () => {
    expect(parseReceiveList("Стакан; 500 шт; 600", L).rows[0]).toMatchObject({ ingredientId: "c", quantity: "500" });
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
