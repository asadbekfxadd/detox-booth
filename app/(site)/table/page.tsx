import Link from "next/link";
import { getCurrentTable } from "@/lib/site-table";
import { getGuestBill } from "@/services/tables";
import { GUEST_STATUS } from "@/lib/table-bill";
import { sum, dateTimeStr } from "@/lib/format";
import { Page } from "@/components/site/Page";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { requestBillAction } from "../actions";

export const metadata = { title: "Мой счёт", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CLS: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-900", CONFIRMED: "bg-sky-100 text-sky-900", PREPARING: "bg-amber-100 text-amber-900",
  READY: "bg-lime-200 text-green-950", COMPLETED: "bg-forest/10 text-forest", CANCELLED: "bg-red-100 text-red-800",
};

export default async function TablePage() {
  const table = await getCurrentTable();
  if (!table)
    return (
      <Page className="space-y-4 text-center">
        <h1 className="text-3xl font-black sm:text-5xl">Стол не выбран</h1>
        <p className="mx-auto max-w-md text-forest/70">Отсканируйте QR-код на вашем столе, чтобы заказывать прямо с телефона. Блюда принесём к столу.</p>
        <Link href="/menu" className="btn btn-primary">Смотреть меню</Link>
      </Page>
    );

  const bill = await getGuestBill(table);
  const live = bill.orders.filter((o) => o.status !== "CANCELLED");
  const waiting = live.some((o) => o.status !== "COMPLETED");
  return (
    <Page className="mx-auto max-w-2xl space-y-6">
      <AutoRefresh active everyMs={10000} />
      <div>
        <p className="font-bold text-forest/60">{bill.locationName}</p>
        <h1 className="text-4xl font-black sm:text-5xl">Стол №{bill.tableNumber}</h1>
      </div>

      {live.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-forest/25 p-8 text-center">
          <p className="font-bold">{bill.justClosed ? "Счёт закрыт. Спасибо, что были у нас!" : "Заказов пока нет"}</p>
          <p className="mt-1 text-sm text-forest/60">Выберите напитки в меню и отправьте заказ на кухню.</p>
          <Link href="/menu" className="btn btn-primary mt-4">В меню</Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {bill.orders.map((o) => (
              <li key={o.id} className={`space-y-2 rounded-2xl bg-white p-5 pop ${o.status === "CANCELLED" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-extrabold">Заказ №{o.number} <span className="font-medium text-forest/55">· {dateTimeStr(o.createdAt)}</span></p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${CLS[o.status] ?? ""}`}>{GUEST_STATUS[o.status] ?? o.status}</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span>{i.quantity} × {i.name}{i.options.length > 0 && <span className="text-forest/60"> ({i.options.join(", ")})</span>}</span>
                      <span className="whitespace-nowrap">{sum(i.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                {o.note && <p className="text-xs text-forest/60">Комментарий: {o.note}</p>}
              </li>
            ))}
          </ul>

          <div className="space-y-3 rounded-2xl bg-forest-deep p-5 text-white">
            <p className="flex items-baseline justify-between gap-4 text-2xl font-black"><span>Итого по счёту</span><span>{sum(bill.total)}</span></p>
            {bill.requested
              ? <p role="status" className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold">Мы поняли: сейчас подойдём со счётом.{waiting && " Заказы, которые ещё готовятся, принесём до оплаты."}</p>
              : (
                <form action={requestBillAction}>
                  <button className="btn btn-primary w-full">Попросить счёт</button>
                </form>
              )}
            <p className="text-xs text-white/60">Оплата наличными или картой у официанта. Счёт один на весь стол.</p>
          </div>
          <Link href="/menu" className="btn btn-ghost w-full">Заказать ещё</Link>
        </>
      )}
    </Page>
  );
}
