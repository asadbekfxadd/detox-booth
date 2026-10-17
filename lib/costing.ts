/**
 * Калькуляция: полная себестоимость одного напитка.
 *
 *   ингредиенты + упаковка + потери + амортизация оборудования + зарплата + накладные
 *
 * - Ингредиенты: количество в рецепте × средняя закупочная цена (Ingredient.avgCost).
 * - Упаковка: ингредиенты рецепта из категории «Packaging/Упаковка» + общая сумма на напиток из настроек (стаканчик, крышка, трубочка).
 * - Потери: процент от стоимости ингредиентов (проливы, брак, заготовки).
 * - Амортизация: цена оборудования ÷ его ресурс в напитках. Оборудование категории (выжималка для соков) относится только к её напиткам.
 * - Зарплата: оклады сотрудников (с взносами) за месяц ÷ число напитков за месяц.
 * - Накладные: аренда и коммунальные за месяц ÷ число напитков за месяц.
 * Здесь только арифметика, без базы: всё считается из переданных чисел, поэтому легко проверять тестами.
 */

export type CostIngredient = { name: string; quantity: number; avgCost: number; category: string };
export type CostProduct = { id: string; name: string; categoryId: string; categoryName: string; price: number; ingredients: CostIngredient[] };
export type CostEquipment = { id: string; name: string; price: number; lifeDrinks: number; categoryId: string | null };
export type CostConfig = {
  /** Упаковка на напиток сверх рецепта, UZS */
  packagingPerDrink: number;
  /** Потери на ингредиентах, % */
  lossPct: number;
  /** Взносы и налоги сверх оклада, % */
  payrollTaxPct: number;
  /** Сумма окладов за месяц без взносов, UZS */
  salaryMonthly: number;
  /** Аренда и коммунальные за месяц, UZS */
  overheadMonthly: number;
  /** Число напитков в месяц, на которое делятся зарплата и накладные */
  drinksPerMonth: number;
};

export type CostBreakdown = {
  ingredients: number; packaging: number; loss: number; amortization: number; labor: number; overhead: number;
  total: number;
  /** Цена − полная себестоимость. null, если рецепта нет и считать нечего */
  profit: number | null; marginPct: number | null;
  hasRecipe: boolean;
  /** Из каких единиц оборудования сложилась амортизация */
  equipment: { id: string; name: string; perDrink: number }[];
};

const PACKAGING = ["packaging", "упаковка", "тара", "посуда"];
/** Ингредиент относится к упаковке (стаканчик, крышка, трубочка), а не к составу напитка */
export const isPackaging = (category: string) => PACKAGING.includes(category.trim().toLowerCase());

/** Амортизация одного напитка от единицы оборудования. Нет ресурса — 0 (не делим на ноль). */
export const equipmentPerDrink = (e: Pick<CostEquipment, "price" | "lifeDrinks">) => (e.lifeDrinks > 0 ? Math.max(0, e.price) / e.lifeDrinks : 0);

/** Зарплата и накладные на один напиток. Нет напитков в месяц — 0: делить не на что, на странице покажем предупреждение. */
export function monthlyShares(c: Pick<CostConfig, "salaryMonthly" | "payrollTaxPct" | "overheadMonthly" | "drinksPerMonth">) {
  const n = c.drinksPerMonth;
  if (!(n > 0)) return { labor: 0, overhead: 0 };
  return { labor: (c.salaryMonthly * (1 + c.payrollTaxPct / 100)) / n, overhead: c.overheadMonthly / n };
}

export function costProduct(p: CostProduct, equipment: CostEquipment[], c: CostConfig): CostBreakdown {
  let ingredients = 0, recipePackaging = 0;
  for (const i of p.ingredients) {
    const v = i.quantity * i.avgCost;
    if (isPackaging(i.category)) recipePackaging += v; else ingredients += v;
  }
  const packaging = recipePackaging + Math.max(0, c.packagingPerDrink);
  const loss = ingredients * (Math.max(0, c.lossPct) / 100);
  const used = equipment.filter((e) => e.categoryId == null || e.categoryId === p.categoryId).map((e) => ({ id: e.id, name: e.name, perDrink: equipmentPerDrink(e) }));
  const amortization = used.reduce((a, e) => a + e.perDrink, 0);
  const { labor, overhead } = monthlyShares(c);
  const total = ingredients + packaging + loss + amortization + labor + overhead;
  const hasRecipe = p.ingredients.length > 0;
  return {
    ingredients, packaging, loss, amortization, labor, overhead, total, hasRecipe, equipment: used,
    profit: hasRecipe ? p.price - total : null,
    marginPct: hasRecipe && p.price > 0 ? ((p.price - total) / p.price) * 100 : null,
  };
}

/**
 * Число напитков, на которое делим месячные затраты: плановое из настроек, а если оно не задано — фактически проданное за 30 дней.
 * Плановое нужно, пока продаж мало: иначе на первые десять напитков ляжет вся аренда.
 */
export function drinksBasis(planned: number, sold30: number): { value: number; source: "plan" | "fact" | "none" } {
  if (planned > 0) return { value: planned, source: "plan" };
  if (sold30 > 0) return { value: sold30, source: "fact" };
  return { value: 0, source: "none" };
}

export const EXPENSE_MONTHS = 3;

/**
 * Расходы за последние EXPENSE_MONTHS месяцев (сумма по категориям) → среднее в месяц.
 * Зарплатные расходы (SALARY) отделены от остальных: зарплата в калькуляции берётся из окладов сотрудников,
 * а расход «Зарплата» из «Финансов» используется, только если окладов нет (иначе она бы посчиталась дважды).
 */
export function monthlyExpenses(totals: Record<string, number>, months = EXPENSE_MONTHS) {
  const perMonth: Record<string, number> = {};
  for (const [k, v] of Object.entries(totals)) perMonth[k] = Math.max(0, v) / months;
  const salary = perMonth.SALARY ?? 0;
  const other = Object.entries(perMonth).filter(([k]) => k !== "SALARY").reduce((a, [, v]) => a + v, 0);
  return { perMonth, salary, other };
}
