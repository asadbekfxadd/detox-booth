import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { ApiError } from "@/lib/api";
import { getOrderReceipt } from "@/services/print";
import { sum as money, dateTimeStr } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/order-status";
import { Paper, Dash, Row } from "@/components/print/Paper";
import { ReceiptHead, ReceiptFoot } from "@/components/print/ReceiptParts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Чек" };

export default async function OrderReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  const user = await pageGuard("print.use");
  const [{ id }, { auto }] = await Promise.all([params, searchParams]);
  let r;
  try { r = await getOrderReceipt(id, user); }
  catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }
  return (
    <Paper auto={auto === "1"}>
      <ReceiptHead brand={r.brand} location={r.location} />
      <Dash />
      <Row k={`Чек №${r.number}`} v={dateTimeStr(r.createdAt)} />
      {r.tableNumber != null && <Row k="Стол" v={r.tableNumber} />}
      {r.cashier && <Row k="Кассир" v={r.cashier} />}
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
      {(r.discount > 0 || r.deliveryFee > 0 || r.serviceFee > 0) && <Row k="Сумма" v={money(r.subtotal)} />}
      {r.discount > 0 && <Row k="Скидка" v={`−${money(r.discount)}`} />}
      {r.deliveryFee > 0 && <Row k="Доставка" v={money(r.deliveryFee)} />}
      {r.serviceFee > 0 && <Row k="Сервисный сбор" v={money(r.serviceFee)} />}
      <Row k="ИТОГО" v={money(r.total)} bold big />
      {r.tip > 0 && <Row k="Чаевые" v={money(r.tip)} />}
      {r.method && <Row k={r.paid ? "Оплата" : "Способ оплаты"} v={`${METHOD_LABEL[r.method] ?? r.method}${r.paid ? "" : " (не оплачен)"}`} />}
      {r.cancelled && <p className="mt-2 text-center font-bold">ЗАКАЗ ОТМЕНЁН</p>}
      <ReceiptFoot />
    </Paper>
  );
}
