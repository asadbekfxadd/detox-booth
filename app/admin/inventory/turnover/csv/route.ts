import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { getScope } from "@/lib/location";
import { getTurnover } from "@/services/turnover";
import { periodBounds } from "@/lib/turnover";
import { bigUnit } from "@/lib/ingredient-units";

/** CSV для Excel: количества в кг, л и шт, десятичная запятая, разделитель «;» (так Excel в русской локали открывает без мастера). */
export async function GET(req: Request) {
  try {
    await requireUser("inventory.view");
    const u = new URL(req.url);
    const from = u.searchParams.get("from") ?? "", to = u.searchParams.get("to") ?? "";
    const b = periodBounds(from, to);
    if (!b) return NextResponse.json({ error: "Некорректные даты" }, { status: 400 });
    const { locationId } = await getScope();
    const lines = await getTurnover(locationId, b.from, b.to, { includeEmpty: u.searchParams.get("all") === "1" });
    const n = (unit: string, v: number) => String(Math.round((v / bigUnit(unit).factor) * 1000) / 1000).replace(".", ",");
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const head = ["Продукт", "Единица", "На начало", "Приход", "Из заготовок", "Продажи", "Списания", "В заготовки", "Перемещено", "Поправки", "На конец", "Сумма на конец, UZS"];
    const rows = lines.map((l) => [q(l.name), bigUnit(l.unit).label, n(l.unit, l.opening), n(l.unit, l.receipts), n(l.unit, l.prodIn), n(l.unit, l.sales), n(l.unit, l.writeOffs), n(l.unit, l.prodOut), n(l.unit, l.transferOut), n(l.unit, l.adjust), n(l.unit, l.closing), String(Math.round(l.closingValue))].join(";"));
    const body = "﻿" + [head.join(";"), ...rows].join("\r\n");
    return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="turnover-${from}_${to}.csv"` } });
  } catch (e) { return handleError(e); }
}
