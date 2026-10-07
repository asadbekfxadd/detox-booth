import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE = 30;
export type AuditFilters = { userId?: string; action?: string; q?: string; from?: string; to?: string; page?: number };

const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined);

export async function listAudit(f: AuditFilters) {
  const from = day(f.from), to = day(f.to);
  const where: Prisma.AuditLogWhereInput = {
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.action ? { action: f.action } : {}),
    ...(f.q ? { OR: [{ entityId: { contains: f.q, mode: "insensitive" } }, { entity: { contains: f.q, mode: "insensitive" } }] } : {}),
    ...((from || to) ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00+05:00`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00+05:00`).getTime() + 86400000) } : {}) } } : {}),
  };
  const page = Math.max(1, Math.floor(f.page || 1));
  const [rows, count, users, actions] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { name: true, role: true } } } }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  return { rows, count, page, pages: Math.max(1, Math.ceil(count / PAGE)), users, actions: actions.map((a) => a.action) };
}
