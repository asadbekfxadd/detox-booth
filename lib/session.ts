import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Сессия + свежая проверка в базе: сотрудник, которого отключили или у которого сменили
 * роль/точку, теряет доступ сразу, а не когда истечёт JWT (до 8 часов).
 * Кэшируется на время одного запроса.
 */
export const currentSession = cache(async () => {
  const s = await auth();
  if (!s?.user?.id) return null;
  const u = await prisma.user.findUnique({ where: { id: s.user.id }, select: { isActive: true, role: true, locationId: true, name: true } });
  if (!u || !u.isActive) return null;
  return { ...s, user: { ...s.user, role: u.role, locationId: u.locationId, name: u.name } };
});
