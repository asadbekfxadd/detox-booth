import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getSettingValues } from "@/services/settings";
import { costProduct, drinksBasis, equipmentPerDrink, monthlyExpenses, monthlyShares, type CostEquipment } from "@/lib/costing";

const DAY = 86400000;

const blank = (v: unknown) => (v === "" || v == null ? undefined : v);
export const equipmentSchema = z.object({
  name: z.string().trim().min(2, "Укажите название оборудования").max(80, "Слишком длинное название"),
  price: z.preprocess(blank, z.coerce.number({ error: "Укажите цену" }).positive("Цена должна быть больше 0").max(10_000_000_000, "Слишком большая цена")),
  lifeDrinks: z.preprocess(blank, z.coerce.number({ error: "Укажите ресурс в напитках" }).int("Ресурс — целое число").min(1, "Ресурс — минимум 1 напиток").max(100_000_000, "Слишком большой ресурс")),
  categoryId: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().nullable()),
});

/** Всё для страницы «Калькуляция». Не ограничивается точкой: себестоимость считается по компании. */
export async function getCosting() {
  const now = Date.now();
  const [products, equipment, staff, settings, sold, expenseAgg] = await Promise.all([
    prisma.product.findMany({
      where: { isArchived: false },
      include: { category: true, recipe: { include: { items: { include: { ingredient: true } } } } },
      orderBy: [{ category: { sort: "asc" } }, { name: "asc" }],
    }),
    prisma.equipment.findMany({ include: { category: { select: { name: true } } }, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.user.findMany({ where: { isActive: true, monthlySalary: { not: null } }, select: { monthlySalary: true } }),
    getSettingValues(),
    prisma.orderItem.aggregate({ where: { order: { status: "COMPLETED", createdAt: { gte: new Date(now - 30 * DAY) } } }, _sum: { quantity: true } }),
    prisma.expense.groupBy({ by: ["category"], where: { date: { gte: new Date(now - 90 * DAY) } }, _sum: { amount: true } }),
  ]);

  const fund = staff.reduce((a, u) => a + Number(u.monthlySalary), 0);
  const sold30 = sold._sum.quantity ?? 0;
  const basis = drinksBasis(settings["costing.plannedDrinks"], sold30);
  const exp = monthlyExpenses(Object.fromEntries(expenseAgg.map((e) => [e.category, Number(e._sum.amount ?? 0)])));
  // Окладов нет — берём расход «Зарплата» из «Финансов» как есть (взносы в нём уже учтены).
  const salaryFromExpenses = staff.length === 0 && exp.salary > 0;
  const salaryMonthly = salaryFromExpenses ? exp.salary : fund;
  const payrollTaxPct = salaryFromExpenses ? 0 : settings["costing.payrollTaxPct"];
  const overheadManual = settings["costing.overheadMonthly"] > 0;
  const cfg = {
    packagingPerDrink: settings["costing.packagingPerDrink"], lossPct: settings["costing.lossPct"], payrollTaxPct,
    salaryMonthly, overheadMonthly: overheadManual ? settings["costing.overheadMonthly"] : exp.other, drinksPerMonth: basis.value,
  };
  const activeEq: CostEquipment[] = equipment.filter((e) => e.isActive).map((e) => ({ id: e.id, name: e.name, price: Number(e.price), lifeDrinks: e.lifeDrinks, categoryId: e.categoryId }));

  const rows = products.map((p) => {
    const b = costProduct({
      id: p.id, name: p.name, categoryId: p.categoryId, categoryName: p.category.name, price: Number(p.price),
      ingredients: (p.recipe?.items ?? []).map((i) => ({ name: i.ingredient.name, quantity: Number(i.quantity), avgCost: Number(i.ingredient.avgCost), category: i.ingredient.category })),
    }, activeEq, cfg);
    return { id: p.id, name: p.name, category: p.category.name, price: Number(p.price), ...b };
  });
  const shares = monthlyShares(cfg);
  return {
    rows, basis, sold30, shares, salaryMonthly, salaryCount: staff.length, payrollTaxPct, salaryFromExpenses,
    expenses: exp.perMonth,
    overheadMonthly: cfg.overheadMonthly, overheadManual,
    equipment: equipment.map((e) => ({ id: e.id, name: e.name, price: Number(e.price), lifeDrinks: e.lifeDrinks, isActive: e.isActive, category: e.category?.name ?? null, perDrink: equipmentPerDrink({ price: Number(e.price), lifeDrinks: e.lifeDrinks }) })),
  };
}

export const listCostCategories = () => prisma.category.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }], select: { id: true, name: true } });
export const getEquipment = async (id: string) => {
  const e = await prisma.equipment.findUnique({ where: { id } });
  return e ? { id: e.id, name: e.name, price: Number(e.price), lifeDrinks: e.lifeDrinks, categoryId: e.categoryId, isActive: e.isActive } : null;
};

async function checkCategory(categoryId: string | null) {
  if (categoryId && !(await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) throw new ApiError(400, "Категория не найдена");
}

export async function createEquipment(input: unknown, userId: string) {
  const d = equipmentSchema.parse(input);
  await checkCategory(d.categoryId);
  const e = await prisma.equipment.create({ data: d });
  await audit({ userId, action: "EQUIPMENT_CREATED", entity: "Equipment", entityId: e.id, newValue: d });
}

export async function updateEquipment(id: string, input: unknown, userId: string) {
  const d = equipmentSchema.parse(input);
  const old = await prisma.equipment.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Оборудование не найдено");
  await checkCategory(d.categoryId);
  await prisma.equipment.update({ where: { id }, data: d });
  await audit({ userId, action: "EQUIPMENT_UPDATED", entity: "Equipment", entityId: id, oldValue: { name: old.name, price: Number(old.price), lifeDrinks: old.lifeDrinks, categoryId: old.categoryId }, newValue: d });
}

/** Списанное оборудование не удаляем сразу: выключаем, чтобы не считалось в себестоимости, но осталась история. Удалить можно выключенное. */
export async function setEquipmentActive(id: string, active: boolean, userId: string) {
  const old = await prisma.equipment.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Оборудование не найдено");
  await prisma.equipment.update({ where: { id }, data: { isActive: active } });
  await audit({ userId, action: "EQUIPMENT_TOGGLED", entity: "Equipment", entityId: id, oldValue: { isActive: old.isActive }, newValue: { isActive: active } });
}

export async function deleteEquipment(id: string, userId: string) {
  const old = await prisma.equipment.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Оборудование не найдено");
  await prisma.equipment.delete({ where: { id } });
  await audit({ userId, action: "EQUIPMENT_DELETED", entity: "Equipment", entityId: id, oldValue: { name: old.name, price: Number(old.price) } });
}
