import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function audit(p: { userId?: string; action: string; entity: string; entityId?: string; oldValue?: Prisma.InputJsonValue; newValue?: Prisma.InputJsonValue; ip?: string }) {
  return prisma.auditLog.create({ data: p });
}
