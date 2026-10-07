import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError } from "@/lib/api";
import { canSwitchLocation } from "@/lib/rbac";
import { parseRange } from "@/services/dashboard";
import { getFinance, EXPENSE_LABEL } from "@/services/finance";
import { getSales } from "@/services/sales";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (...v: unknown[]) => v.map(cell).join(";");

/** CSV для Excel (разделитель «;», UTF-8 с BOM). Финансы — finance.view, продажи — orders.view. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const report = url.searchParams.get("report") === "sales" ? "sales" : "finance";
    const user = await requireUser(report === "sales" ? "orders.view" : "finance.view");
    let locationId: string | null = user.locationId;
    if (canSwitchLocation(user.role)) {
      const c = (await cookies()).get("loc")?.value;
      locationId = c && (await prisma.location.findFirst({ where: { id: c, isActive: true } })) ? c : null;
    }
    const range = parseRange({ range: url.searchParams.get("range") ?? undefined, from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
    const rows: string[] = [];
    if (report === "finance") {
      const f = await getFinance(range, locationId);
      rows.push(line("Дата", "Заказов", "Выручка", "Валовая прибыль", "Расходы"));
      for (const d of f.byDay) rows.push(line(d.date, d.orders, Math.round(d.revenue), Math.round(d.profit), Math.round(d.expenses)));
      rows.push("", line("Итого", f.orders, Math.round(f.revenue), Math.round(f.gross), Math.round(f.expenses)));
      rows.push(line("Себестоимость", Math.round(f.cogs)), line("Списания", Math.round(f.writeOffs)), line("Чистая прибыль", Math.round(f.net)));
      rows.push("", line("Расходы: дата", "Категория", "Точка", "Комментарий", "Сумма"));
      for (const e of f.expenseRows) rows.push(line(e.date.toISOString().slice(0, 10), EXPENSE_LABEL[e.category], e.location, e.note ?? "", Math.round(e.amount)));
    } else {
      const s = await getSales(range, locationId);
      rows.push(line("Дата", "Заказов", "Выручка", "Скидки", "Средний чек"));
      for (const d of s.byDay) rows.push(line(d.date, d.orders, Math.round(d.revenue), Math.round(d.discount), Math.round(d.avg)));
      rows.push("", line("Продукт", "Категория", "Продано, шт", "Выручка", "Доля, %"));
      for (const p of s.products) rows.push(line(p.name, p.category, p.qty, Math.round(p.revenue), p.share.toFixed(1)));
    }
    const name = `${report}-${new Date(range.from.getTime() + 5 * 3600000).toISOString().slice(0, 10)}_${new Date(range.to.getTime() + 5 * 3600000 - 1).toISOString().slice(0, 10)}.csv`;
    return new NextResponse("﻿" + rows.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  } catch (e) { return handleError(e); }
}
