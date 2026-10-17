import { describe, it, expect } from "vitest";
import { costProduct, drinksBasis, monthlyExpenses, equipmentPerDrink, isPackaging, monthlyShares, type CostConfig, type CostProduct, type CostEquipment } from "@/lib/costing";

const cfg: CostConfig = { packagingPerDrink: 0, lossPct: 0, payrollTaxPct: 0, salaryMonthly: 0, overheadMonthly: 0, drinksPerMonth: 0 };
const orange: CostProduct = {
  id: "p1", name: "Свежевыжатый апельсин", categoryId: "juice", categoryName: "Соки", price: 30000,
  ingredients: [
    { name: "Апельсин", quantity: 500, avgCost: 8, category: "Фрукты" },
    { name: "Стакан 400 мл", quantity: 1, avgCost: 600, category: "Packaging" },
  ],
};
const juicer: CostEquipment = { id: "e1", name: "Выжималка", price: 6_000_000, lifeDrinks: 30000, categoryId: "juice" };
const blender: CostEquipment = { id: "e2", name: "Блендер", price: 3_000_000, lifeDrinks: 30000, categoryId: "smoothie" };
const fridge: CostEquipment = { id: "e3", name: "Холодильник", price: 9_000_000, lifeDrinks: 90000, categoryId: null };

describe("costing", () => {
  it("распознаёт упаковку по категории ингредиента", () => {
    expect(isPackaging("Packaging")).toBe(true);
    expect(isPackaging(" упаковка ")).toBe(true);
    expect(isPackaging("Фрукты")).toBe(false);
  });

  it("ингредиенты и упаковка из рецепта считаются отдельно", () => {
    const r = costProduct(orange, [], cfg);
    expect(r.ingredients).toBe(4000);
    expect(r.packaging).toBe(600);
    expect(r.total).toBe(4600);
    expect(r.profit).toBe(25400);
    expect(r.marginPct).toBeCloseTo(84.67, 1);
  });

  it("общая упаковка на напиток добавляется к упаковке из рецепта", () => {
    expect(costProduct(orange, [], { ...cfg, packagingPerDrink: 400 }).packaging).toBe(1000);
  });

  it("потери считаются от ингредиентов, а не от упаковки", () => {
    const r = costProduct(orange, [], { ...cfg, lossPct: 10 });
    expect(r.loss).toBe(400);
    expect(r.total).toBe(5000);
  });

  it("амортизация: цена ÷ ресурс, оборудование категории не попадает в чужие напитки", () => {
    expect(equipmentPerDrink(juicer)).toBe(200);
    const r = costProduct(orange, [juicer, blender, fridge], cfg);
    expect(r.amortization).toBe(200 + 100);
    expect(r.equipment.map((e) => e.name)).toEqual(["Выжималка", "Холодильник"]);
  });

  it("нулевой ресурс не ломает расчёт", () => {
    expect(equipmentPerDrink({ price: 1000, lifeDrinks: 0 })).toBe(0);
  });

  it("зарплата с взносами и накладные делятся на число напитков", () => {
    const s = monthlyShares({ salaryMonthly: 10_000_000, payrollTaxPct: 12, overheadMonthly: 5_000_000, drinksPerMonth: 4000 });
    expect(s.labor).toBeCloseTo(2800, 6);
    expect(s.overhead).toBe(1250);
    const r = costProduct(orange, [], { ...cfg, salaryMonthly: 10_000_000, payrollTaxPct: 12, overheadMonthly: 5_000_000, drinksPerMonth: 4000 });
    expect(r.total).toBeCloseTo(4600 + 2800 + 1250, 6);
  });

  it("нет напитков в месяц: зарплата и накладные не делятся на ноль", () => {
    expect(monthlyShares({ salaryMonthly: 1000, payrollTaxPct: 0, overheadMonthly: 1000, drinksPerMonth: 0 })).toEqual({ labor: 0, overhead: 0 });
  });

  it("без рецепта прибыль и маржа не считаются", () => {
    const r = costProduct({ ...orange, ingredients: [] }, [juicer], cfg);
    expect(r.hasRecipe).toBe(false);
    expect(r.profit).toBeNull();
    expect(r.marginPct).toBeNull();
  });

  it("отрицательная цена продажи не даёт деления на ноль в марже", () => {
    expect(costProduct({ ...orange, price: 0 }, [], cfg).marginPct).toBeNull();
  });

  it("основа деления: план важнее факта, факта нет — ноль", () => {
    expect(drinksBasis(3000, 500)).toEqual({ value: 3000, source: "plan" });
    expect(drinksBasis(0, 500)).toEqual({ value: 500, source: "fact" });
    expect(drinksBasis(0, 0)).toEqual({ value: 0, source: "none" });
  });

  it("расходы: среднее в месяц, зарплата отдельно от остальных", () => {
    const e = monthlyExpenses({ RENT: 9_000_000, UTILITIES: 3_000_000, SALARY: 30_000_000, MARKETING: 600_000 });
    expect(e.perMonth.RENT).toBe(3_000_000);
    expect(e.salary).toBe(10_000_000);
    expect(e.other).toBe(3_000_000 + 1_000_000 + 200_000);
    expect(monthlyExpenses({}).other).toBe(0);
  });
});
