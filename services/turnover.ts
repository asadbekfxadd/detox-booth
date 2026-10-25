import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRow, isEmptyRow, type Kind, type Moves, type TurnoverRow } from "@/lib/turnover";

export type TurnoverLine = TurnoverRow & { id: string; name: string; unit: string; category: string; openingValue: number; closingValue: number };

type Agg = { ingredientId: string; kind: string; inPeriod: Prisma.Decimal | null; after: Prisma.Decimal | null };

/** Оборотная ведомость за период [from, to). locationId null — по всем точкам. */
export async function getTurnover(locationId: string | null, from: Date, to: Date, opts: { includeEmpty?: boolean } = {}) {
  const loc = locationId ? Prisma.sql`AND t."locationId" = ${locationId}` : Prisma.empty;
  const [ings, stocks, aggs] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockItem.groupBy({ by: ["ingredientId"], where: locationId ? { locationId } : {}, _sum: { quantity: true } }),
    // возврат при отмене заказа записан как корректировка: в отчёте это та же продажа (уменьшает расход)
    prisma.$queryRaw<Agg[]>(Prisma.sql`
      SELECT t."ingredientId",
             CASE WHEN t."type"::text = 'ADJUSTMENT' AND t."refType" = 'OrderRestock' THEN 'SALE' ELSE t."type"::text END AS kind,
             SUM(CASE WHEN t."createdAt" >= ${from} AND t."createdAt" < ${to} THEN t."quantity" ELSE 0 END) AS "inPeriod",
             SUM(CASE WHEN t."createdAt" >= ${to} THEN t."quantity" ELSE 0 END) AS "after"
      FROM "InventoryTransaction" t
      WHERE t."createdAt" >= ${from} ${loc}
      GROUP BY 1, 2`),
  ]);
  const cur = new Map(stocks.map((s) => [s.ingredientId, Number(s._sum.quantity ?? 0)]));
  const moves = new Map<string, { inP: Moves; after: Moves }>();
  for (const a of aggs) {
    const m = moves.get(a.ingredientId) ?? { inP: {}, after: {} };
    m.inP[a.kind as Kind] = Number(a.inPeriod ?? 0);
    m.after[a.kind as Kind] = Number(a.after ?? 0);
    moves.set(a.ingredientId, m);
  }
  const lines: TurnoverLine[] = [];
  for (const i of ings) {
    const m = moves.get(i.id);
    const row = buildRow(cur.get(i.id) ?? 0, m?.inP ?? {}, m?.after ?? {});
    if (!opts.includeEmpty && isEmptyRow(row)) continue;
    const avg = Number(i.avgCost);
    lines.push({ ...row, id: i.id, name: i.name, unit: i.unit as string, category: i.category, openingValue: row.opening * avg, closingValue: row.closing * avg });
  }
  return lines;
}
