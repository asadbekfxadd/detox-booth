import type { Prisma } from "@prisma/client";

/**
 * Эксклюзивная блокировка склада точки до конца транзакции (pg_advisory_xact_lock).
 * Все операции, которые читают остатки и затем списывают/перемещают партии, берут её первой:
 * два параллельных заказа на последнюю порцию больше не уводят партию в минус.
 * Повторный захват в той же транзакции безопасен. Блокировки нескольких точек берём в порядке id (без взаимоблокировок).
 */
export async function lockStock(tx: Prisma.TransactionClient, ...locationIds: string[]) {
  for (const id of [...new Set(locationIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"stock:" + id}))`;
  }
}
