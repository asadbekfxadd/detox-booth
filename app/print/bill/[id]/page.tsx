import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { ApiError } from "@/lib/api";
import { getBillReceipt } from "@/services/print";
import { sum as money, dateTimeStr } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/order-status";
import { Paper, Dash, Row } from "@/components/print/Paper";
import { ReceiptHead, ReceiptFoot } from "@/components/print/ReceiptParts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Счёт стола" };

export default async function BillReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const user = await pageGuard("print.use");
  const [{ id }, { auto }] = await Promise.all([params, searchParams]);
  let r;
  try { r = await getBillReceipt(id, user); }
  catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }
  return (
    <Paper auto={auto === "1"}>
      <ReceiptHead brand={r.brand} location={r.location} />
      <Dash />
      <p className="text-center text-[15px] font-bold">{r.closed && !r.isOpen ? "ЧЕК" : "ПРЕДВАРИТЕЛЬНЫЙ СЧЁТ"}</p>
      <Row k={`Стол ${r.tableNumber}`} v={dateTimeStr(r.closedAt ?? new Date())} />
      <Dash />
      <ul className="space-y-1">
        {r.items.map((i) => (
          <li key={i.id}>
            <p>{i.name}</p>
            {i.options.length > 0 && <p className="pl-2 text-[11px]">{i.options.join(", ")}</p>}
            <Row k={`${i.quantity} × ${money(i.unitPrice)}`} v={money(i.lineTotal)} />
          </li>
        ))}
      </ul>
      <Dash />
      {r.fee > 0 && <Row k="Сумма" v={money(r.subtotal)} />}
      {r.fee > 0 && <Row k={`Сервисный сбор${r.feePct > 0 ? ` ${r.feePct}%` : ""}`} v={money(r.fee)} />}
      <Row k="ИТОГО" v={money(r.total)} bold big />
      {r.paid > 0 && r.due > 0 && <Row k="Уже оплачено" v={money(r.paid)} />}
      {r.due > 0 && r.paid > 0 && <Row k="К оплате" v={money(r.due)} bold />}
      {r.tip > 0 && <Row k="Чаевые" v={money(r.tip)} />}
      {r.methods.length > 0 && <Row k="Оплата" v={r.methods.map((m) => METHOD_LABEL[m] ?? m).join(", ")} />}
      <ReceiptFoot note={r.isOpen ? "Оплата у официанта или на кассе" : undefined} />
    </Paper>
  );
}
