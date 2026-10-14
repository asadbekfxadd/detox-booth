import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PairStat } from "@/lib/upsell";

const WINDOW_DAYS = 90;
const TTL_MS = 5 * 60_000;
const MAX_KEYS = 200;
const cache = new Map<string, { at: number; value: Map<string, PairStat> }>();

type Row = { anchor: string; other: string; n: number; t: number };

/**
 * Что заказывали вместе с позициями корзины за последние 90 дней (без отменённых заказов).
 * Для каждой позиции-кандидата берём ту позицию корзины, с которой её заказывали чаще всего.
 * Результат держим 5 минут: корзина пересчитывается на каждое нажатие «+», а история за это время почти не меняется.
 */
export async function pairStats(anchorIds: string[], now = Date.now()): Promise<Map<string, PairStat>> {
  const ids = [...new Set(anchorIds)].sort();
  if (ids.length === 0) return new Map();
  const key = ids.join(",");
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;

  const since = new Date(now - WINDOW_DAYS * 86_400_000);
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    WITH co AS (
      SELECT a."productId" AS anchor, b."productId" AS other, COUNT(DISTINCT a."orderId")::int AS n
      FROM "OrderItem" a
      JOIN "OrderItem" b ON b."orderId" = a."orderId" AND b."productId" <> a."productId"
      JOIN "Order" o ON o.id = a."orderId"
      WHERE a."productId" IN (${Prisma.join(ids)}) AND o.status <> 'CANCELLED' AND o."createdAt" >= ${since}
      GROUP BY 1, 2
    ), tot AS (
      SELECT i."productId" AS pid, COUNT(DISTINCT i."orderId")::int AS t
      FROM "OrderItem" i
      JOIN "Order" o ON o.id = i."orderId"
      WHERE i."productId" IN (SELECT other FROM co) AND o.status <> 'CANCELLED' AND o."createdAt" >= ${since}
      GROUP BY 1
    )
    SELECT co.anchor, co.other, co.n, tot.t FROM co JOIN tot ON tot.pid = co.other
  `);

  const out = new Map<string, PairStat>();
  for (const r of rows) {
    const cur = out.get(r.other);
    if (!cur || r.n > cur.orders) out.set(r.other, { anchorId: r.anchor, orders: Number(r.n), total: Number(r.t) });
  }
  if (cache.size >= MAX_KEYS) cache.clear();
  cache.set(key, { at: now, value: out });
  return out;
}
