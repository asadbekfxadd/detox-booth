import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/services/pos";

type Actor = { id: string; role: Role; locationId: string | null };
const PAGE = 25;
const blank = (v: unknown) => (v === "" || v == null ? undefined : v);

async function safeAudit(p: Parameters<typeof audit>[0]) {
  try { await audit(p); } catch (e) { console.error("[AUDIT ERROR]", e); }
}

export type CustomerFilters = { q?: string; segment?: string; sort?: string; page?: number };

export async function listCustomers(f: CustomerFilters) {
  const where: Prisma.CustomerWhereInput = {};
  const q = f.q?.trim().slice(0, 60);
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])];
  }
  if (f.segment === "orders") where.orders = { some: { status: "COMPLETED" } };
  if (f.segment === "new") where.orders = { none: { status: "COMPLETED" } };
  if (f.segment === "points") where.loyalty = { is: { points: { gt: 0 } } };
  const orderBy: Prisma.CustomerOrderByWithRelationInput = f.sort === "name" ? { name: "asc" } : f.sort === "points" ? { loyalty: { points: "desc" } } : { createdAt: "desc" };
  const page = Math.max(1, f.page ?? 1);
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({ where, orderBy, skip: (page - 1) * PAGE, take: PAGE, include: { loyalty: { select: { points: true } } } }),
  ]);
  const stats = rows.length
    ? await prisma.order.groupBy({ by: ["customerId"], where: { customerId: { in: rows.map((r) => r.id) }, status: "COMPLETED" }, _count: true, _sum: { total: true }, _max: { createdAt: true } })
    : [];
  const sm = new Map(stats.map((s) => [s.customerId, s]));
  return {
    page, pages: Math.max(1, Math.ceil(total / PAGE)), total,
    rows: rows.map((c) => ({
      id: c.id, name: c.name, phone: c.phone, email: c.email, createdAt: c.createdAt, points: c.loyalty?.points ?? 0,
      orders: sm.get(c.id)?._count ?? 0, spent: Number(sm.get(c.id)?._sum.total ?? 0), last: sm.get(c.id)?._max.createdAt ?? null,
    })),
  };
}

export async function getCustomer(id: string) {
  const c = await prisma.customer.findUnique({ where: { id }, include: { loyalty: true } });
  if (!c) return null;
  const [done, orders, txs, lastDone, referredBy, referrals] = await Promise.all([
    prisma.order.aggregate({ where: { customerId: id, status: "COMPLETED" }, _count: true, _sum: { total: true } }),
    prisma.order.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { location: { select: { name: true } } } }),
    c.loyalty ? prisma.loyaltyTransaction.findMany({ where: { accountId: c.loyalty.id }, orderBy: { createdAt: "desc" }, take: 40 }) : Promise.resolve([]),
    prisma.order.findFirst({ where: { customerId: id, status: "COMPLETED" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    c.referredById ? prisma.customer.findUnique({ where: { id: c.referredById }, select: { id: true, name: true, phone: true } }) : Promise.resolve(null),
    prisma.customer.findMany({ where: { referredById: id }, select: { id: true, name: true, phone: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const spent = Number(done._sum.total ?? 0);
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email, birthday: c.birthday, createdAt: c.createdAt,
    points: c.loyalty?.points ?? 0, referredBy, referrals,
    stats: { orders: done._count, spent, avg: done._count ? spent / done._count : 0, last: lastDone?.createdAt ?? null },
    orders: orders.map((o) => ({ id: o.id, number: o.number, status: o.status, source: o.source, total: Number(o.total), createdAt: o.createdAt, location: o.location.name })),
    txs: txs.map((t) => ({ id: t.id, type: t.type, points: t.points, note: t.note, orderId: t.orderId, createdAt: t.createdAt })),
  };
}

export const updateCustomerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Укажите имя клиента").max(80, "Слишком длинное имя"),
  phone: z.string().trim().min(1, "Укажите телефон"),
  email: z.preprocess(blank, z.string().trim().email("Некорректный email").max(120).optional()),
  birthday: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата рождения")
    .refine((v) => !Number.isNaN(Date.parse(v)) && v <= new Date().toISOString().slice(0, 10) && v >= "1900-01-01", "Некорректная дата рождения").optional()),
  referrerPhone: z.preprocess(blank, z.string().trim().max(30).optional()),
});

export async function updateCustomer(input: unknown, user: Actor) {
  const d = updateCustomerSchema.parse(input);
  const phone = normalizePhone(d.phone);
  if (!phone) throw new ApiError(400, "Введите телефон в формате +998 90 123 45 67");
  const res = await prisma.$transaction(async (tx) => {
    const c = await tx.customer.findUnique({ where: { id: d.id }, include: { loyalty: true } });
    if (!c) throw new ApiError(404, "Клиент не найден");
    if (phone !== c.phone && (await tx.customer.findUnique({ where: { phone } }))) throw new ApiError(400, "Клиент с таким телефоном уже есть");
    let referredById = c.referredById;
    const refPhone = d.referrerPhone ? normalizePhone(d.referrerPhone) : null;
    if (d.referrerPhone && !refPhone) throw new ApiError(400, "Телефон пригласившего введён неверно");
    if (refPhone) {
      const r = await tx.customer.findUnique({ where: { phone: refPhone } });
      if (!r) throw new ApiError(400, "Пригласивший клиент с таким телефоном не найден");
      if (r.id === c.id) throw new ApiError(400, "Клиент не может пригласить сам себя");
      referredById = r.id;
    } else referredById = null;
    if (referredById !== c.referredById && c.loyalty && (await tx.loyaltyTransaction.findFirst({ where: { accountId: c.loyalty.id, type: "REFERRAL" } })))
      throw new ApiError(400, "Нельзя менять пригласившего: реферальный бонус уже начислен");
    const next = { name: d.name, phone, email: d.email ?? null, birthday: d.birthday ? new Date(`${d.birthday}T00:00:00+05:00`) : null, referredById };
    await tx.customer.update({ where: { id: c.id }, data: next });
    return { old: { name: c.name, phone: c.phone, email: c.email, referredById: c.referredById }, next: { name: d.name, phone, email: d.email ?? null, referredById } };
  });
  await safeAudit({ userId: user.id, action: "CUSTOMER_UPDATED", entity: "Customer", entityId: d.id, oldValue: res.old, newValue: res.next });
}

export const adjustSchema = z.object({
  id: z.string().min(1),
  delta: z.coerce.number({ error: "Укажите число баллов" }).int("Баллы — целое число").refine((n) => n !== 0, "Укажите число баллов, не 0").refine((n) => Math.abs(n) <= 1_000_000, "Слишком большое число баллов"),
  type: z.enum(["BONUS", "ADJUST"], { error: "Выберите тип" }),
  note: z.string().trim().min(3, "Укажите причину").max(200, "Слишком длинная причина"),
});

export async function adjustPoints(input: unknown, user: Actor) {
  const d = adjustSchema.parse(input);
  if (d.type === "BONUS" && d.delta < 0) throw new ApiError(400, "Бонус не может быть отрицательным: используйте «Корректировка»");
  const balance = await prisma.$transaction(async (tx) => {
    const c = await tx.customer.findUnique({ where: { id: d.id } });
    if (!c) throw new ApiError(404, "Клиент не найден");
    const acc = await tx.loyaltyAccount.upsert({ where: { customerId: c.id }, create: { customerId: c.id, points: 0 }, update: {} });
    if (d.delta < 0) {
      const u = await tx.loyaltyAccount.updateMany({ where: { id: acc.id, points: { gte: -d.delta } }, data: { points: { decrement: -d.delta } } });
      if (u.count === 0) throw new ApiError(400, `Нельзя списать больше, чем есть: у клиента ${acc.points} баллов`);
    } else await tx.loyaltyAccount.update({ where: { id: acc.id }, data: { points: { increment: d.delta } } });
    await tx.loyaltyTransaction.create({ data: { accountId: acc.id, type: d.type, points: d.delta, note: d.note } });
    return (await tx.loyaltyAccount.findUniqueOrThrow({ where: { id: acc.id } })).points;
  });
  await safeAudit({ userId: user.id, action: "LOYALTY_ADJUSTED", entity: "Customer", entityId: d.id, newValue: { delta: d.delta, type: d.type, note: d.note, balance } });
  return balance;
}

export async function loyaltyStats() {
  const since = new Date(Date.now() - 30 * 86400000);
  const [acc, customers, referred, recent] = await Promise.all([
    prisma.loyaltyAccount.aggregate({ _sum: { points: true } }),
    prisma.customer.count(),
    prisma.customer.count({ where: { referredById: { not: null } } }),
    prisma.loyaltyTransaction.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _sum: { points: true } }),
  ]);
  const r = new Map(recent.map((x) => [x.type, x._sum.points ?? 0]));
  return {
    outstanding: acc._sum.points ?? 0, customers, referred,
    earned30: r.get("EARN") ?? 0, spent30: Math.abs(r.get("SPEND") ?? 0), bonus30: (r.get("BONUS") ?? 0) + (r.get("REFERRAL") ?? 0),
  };
}
