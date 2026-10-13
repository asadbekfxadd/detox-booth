import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { ApiError } from "@/lib/api";
import { getKitchenTicket } from "@/services/print";
import { dateTimeStr } from "@/lib/format";
import { Paper, Dash } from "@/components/print/Paper";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бегунок" };

export default async function KitchenTicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ station?: string; auto?: string }> }) {
  const user = await pageGuard("print.use");
  const [{ id }, { station, auto }] = await Promise.all([params, searchParams]);
  let t;
  try { t = await getKitchenTicket(id, user, station || null); }
  catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }
  const where = t.tableNumber != null ? `СТОЛ ${t.tableNumber}` : t.fulfillment === "DELIVERY" ? "ДОСТАВКА" : t.source === "POS" ? "КАССА" : "САМОВЫВОЗ";
  return (
    <Paper auto={auto === "1"}>
      <p className="text-center text-[26px] font-black leading-none">{where}</p>
      <p className="mt-1 text-center text-[18px] font-bold">№{t.number}{t.stationName ? ` · ${t.stationName}` : ""}</p>
      {t.courseLabel && <p className="mt-1 text-center text-[15px] font-bold">** {t.courseLabel.toUpperCase()} **</p>}
      <p className="mt-1 text-center">{dateTimeStr(t.createdAt)}{t.waiter ? ` · ${t.waiter}` : ""}{t.customer && t.tableNumber == null ? ` · ${t.customer}` : ""}</p>
      {t.scheduledFor && <p className="mt-1 text-center font-bold">ВЫДАТЬ К {dateTimeStr(t.scheduledFor)}</p>}
      <Dash />
      <ul className="space-y-1.5">
        {t.lines.map((l) => (
          <li key={l.id}>
            <p className="text-[16px] font-bold">{l.quantity} × {l.name}</p>
            {l.options.length > 0 && <p className="pl-4">{l.options.join(", ")}</p>}
          </li>
        ))}
      </ul>
      {t.note && (<><Dash /><p className="text-[14px] font-bold">!! {t.note}</p></>)}
      <Dash />
      <p className="text-center text-[11px]">{t.location}</p>
    </Paper>
  );
}
