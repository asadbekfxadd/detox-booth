import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { canSwitchLocation } from "@/lib/rbac";
import { startOfDay, type Range } from "@/services/dashboard";
import { getLoyaltySettings } from "@/lib/loyalty-settings";

const TZ = 5 * 3600000;
const DAY = 86400000;
type Actor = { id: string; role: Role; locationId: string | null };
const blank = (v: unknown) => (v === "" || v == null ? undefined : v);
const dayLabel = (d: number) => new Date(d + TZ).toISOString().slice(5, 10);
const dayIso = (d: number) => new Date(d + TZ).toISOString().slice(0, 10);
async function safeAudit(p: Parameters<typeof audit>[0]) {
  try { await audit(p); } catch (e) { console.error("[AUDIT ERROR]", e); }
}

export const EXPENSE_LABEL: Record<string, string> = { RENT: "Аренда", SALARY: "Зарплата", UTILITIES: "Коммунальные", MARKETING: "Маркетинг", DELIVERY: "Доставка", OTHER: "Прочее" };
export const REASON_LABEL: Record<string, string> = { EXPIRED: "Истёк срок", SPOILED: "Испортилось", DAMAGED: "Повреждено", PRODUCTION_WASTE: "Потери при готовке", EMPLOYEE_ERROR: "Ошибка сотрудника", OTHER: "Прочее" };

export async function getFinance(r: Range, locationId: string | null) {
  const loc = locationId ? { locationId } : {};
  const [orders, refunds, wo, woBy, expenses, acc] = await Promise.all([
    prisma.order.findMany({
      where: { ...loc, status: "COMPLETED", createdAt: { gte: r.from, lt: r.to } },
      select: { total: true, cogs: true, discount: true, deliveryFee: true, createdAt: true, payments: { where: { status: "PAID" }, select: { method: true, amount: true } } },
    }),
    prisma.payment.aggregate({ where: { status: "REFUNDED", order: { ...loc, createdAt: { gte: r.from, lt: r.to } } }, _sum: { amount: true }, _count: true }),
    prisma.writeOff.aggregate({ where: { ...loc, createdAt: { gte: r.from, lt: r.to } }, _sum: { cost: true } }),
    prisma.writeOff.groupBy({ by: ["reason"], where: { ...loc, createdAt: { gte: r.from, lt: r.to } }, _sum: { cost: true }, orderBy: { _sum: { cost: "desc" } } }),
    prisma.expense.findMany({ where: { ...loc, date: { gte: r.from, lt: r.to } }, orderBy: { date: "desc" }, include: { location: { select: { name: true } } } }),
    locationId ? Promise.resolve(null) : prisma.loyaltyAccount.aggregate({ _sum: { points: true } }),
  ]);
  const revenue = orders.reduce((a, o) => a + Number(o.total), 0);
  const cogs = orders.reduce((a, o) => a + Number(o.cogs), 0);
  const discounts = orders.reduce((a, o) => a + Number(o.discount), 0);
  const delivery = orders.reduce((a, o) => a + Number(o.deliveryFee), 0);
  const gross = revenue - cogs;
  const woTotal = Number(wo._sum.cost ?? 0);
  const expTotal = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const net = gross - woTotal - expTotal;

  const days = new Map<number, { revenue: number; profit: number; expenses: number; orders: number }>();
  for (let d = startOfDay(r.from.getTime() + 1); d < r.to.getTime(); d += DAY) days.set(d, { revenue: 0, profit: 0, expenses: 0, orders: 0 });
  for (const o of orders) { const x = days.get(startOfDay(o.createdAt.getTime())); if (x) { x.revenue += Number(o.total); x.profit += Number(o.total) - Number(o.cogs); x.orders++; } }
  for (const e of expenses) { const x = days.get(startOfDay(e.date.getTime())); if (x) x.expenses += Number(e.amount); }

  const pay = { CASH: 0, CARD: 0, ONLINE: 0 } as Record<string, number>;
  for (const o of orders) for (const p of o.payments) pay[p.method] += Number(p.amount);
  const expBy = new Map<string, number>();
  for (const e of expenses) expBy.set(e.category, (expBy.get(e.category) ?? 0) + Number(e.amount));
  const pointValue = acc ? (await getLoyaltySettings(prisma)).pointValue : 0;

  return {
    revenue, cogs, gross, discounts, delivery, orders: orders.length,
    writeOffs: woTotal, writeOffsByReason: woBy.map((w) => ({ reason: w.reason, cost: Number(w._sum.cost ?? 0) })),
    expenses: expTotal, expensesByCategory: [...expBy.entries()].map(([category, amount]) => ({ category, name: EXPENSE_LABEL[category], amount })).sort((a, b) => b.amount - a.amount),
    net, netMargin: revenue ? (net / revenue) * 100 : 0, grossMargin: revenue ? (gross / revenue) * 100 : 0,
    refunds: Number(refunds._sum.amount ?? 0), refundCount: refunds._count,
    payments: pay,
    loyaltyLiability: acc ? (acc._sum.points ?? 0) * pointValue : null,
    byDay: [...days.entries()].map(([d, v]) => ({ date: dayIso(d), label: dayLabel(d), ...v })),
    expenseRows: expenses.map((e) => ({ id: e.id, date: e.date, category: e.category, amount: Number(e.amount), note: e.note, location: e.location?.name ?? "Общий" })),
  };
}

export const expenseSchema = z.object({
  category: z.enum(["RENT", "SALARY", "UTILITIES", "MARKETING", "DELIVERY", "OTHER"], { error: "Выберите категорию" }),
  amount: z.coerce.number({ error: "Укажите сумму" }).positive("Сумма должна быть больше 0").max(10_000_000_000, "Слишком большая сумма"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату"),
  note: z.preprocess(blank, z.string().trim().max(200, "Слишком длинный комментарий").optional()),
  locationId: z.preprocess(blank, z.string().optional()),
});

export async function createExpense(input: unknown, user: Actor) {
  const d = expenseSchema.parse(input);
  const when = new Date(`${d.date}T12:00:00+05:00`);
  if (isNaN(when.getTime())) throw new ApiError(400, "Укажите дату");
  if (when.getTime() > Date.now() + DAY) throw new ApiError(400, "Дата расхода не может быть в будущем");
  if (when.getTime() < Date.now() - 800 * DAY) throw new ApiError(400, "Слишком старая дата");
  let locationId: string | null = d.locationId ?? null;
  if (!canSwitchLocation(user.role) && user.locationId) locationId = user.locationId; // привязанные к точке сотрудники пишут только в свою
  if (locationId && !(await prisma.location.findUnique({ where: { id: locationId } }))) throw new ApiError(404, "Точка не найдена");
  const e = await prisma.expense.create({ data: { category: d.category, amount: d.amount, date: when, note: d.note ?? null, locationId } });
  await safeAudit({ userId: user.id, action: "EXPENSE_CREATED", entity: "Expense", entityId: e.id, newValue: { category: d.category, amount: d.amount, date: d.date, locationId, note: d.note ?? null } });
}

export async function deleteExpense(id: string, user: Actor) {
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) throw new ApiError(404, "Расход не найден");
  if (!canSwitchLocation(user.role) && user.locationId && e.locationId !== user.locationId) throw new ApiError(404, "Расход не найден");
  await prisma.expense.delete({ where: { id } });
  await safeAudit({ userId: user.id, action: "EXPENSE_DELETED", entity: "Expense", entityId: id, oldValue: { category: e.category, amount: Number(e.amount), date: e.date.toISOString(), locationId: e.locationId, note: e.note } });
}

export type FinanceWhere = Prisma.OrderWhereInput;
