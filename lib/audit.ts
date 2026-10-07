import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Запись в журнал аудита. Ошибка журнала логируется, но не ломает уже выполненную операцию:
 * иначе пользователь увидит «ошибку», повторит действие и получит дубль (двойной приход, двойное списание).
 */
export async function audit(p: { userId?: string; action: string; entity: string; entityId?: string; oldValue?: Prisma.InputJsonValue; newValue?: Prisma.InputJsonValue; ip?: string }) {
  try { return await prisma.auditLog.create({ data: p }); }
  catch (e) { console.error("[AUDIT ERROR]", p.action, e); return null; }
}
