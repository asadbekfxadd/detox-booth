import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicReservation } from "@/services/reservations";
import { STATUS_LABEL } from "@/lib/booking";
import { dateTimeStr, sum } from "@/lib/format";
import { nowMs } from "@/lib/time";
import { Page } from "@/components/site/Page";
import { AutoRefresh } from "@/components/site/AutoRefresh";
import { CancelBooking } from "@/components/site/CancelBooking";

export const metadata = { title: "Ваша бронь", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getPublicReservation(id);
  if (!r) notFound();
  const open = r.status === "PENDING" || r.status === "CONFIRMED";
  const tone = r.status === "CONFIRMED" ? "bg-lime-100 text-green-900" : r.status === "PENDING" ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-700";
  return (
    <Page>
      <AutoRefresh active={r.status === "PENDING"} />
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <p className="text-sm text-forest/60">{r.name}, спасибо!</p>
          <h1 className="text-3xl font-extrabold">Бронь стола</h1>
        </div>
        <p role="status" className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${tone}`}>{STATUS_LABEL[r.status]}</p>
        <div className="space-y-2 rounded-2xl bg-white p-5 pop">
          <p className="text-xl font-extrabold">{dateTimeStr(r.startsAt)}</p>
          <p>{r.guests} гост. · {r.location.name}{r.location.address ? `, ${r.location.address}` : ""}</p>
          {r.note && <p className="text-sm text-forest/70">Комментарий: {r.note}</p>}
          {r.status === "PENDING" && <p className="text-sm">Администратор позвонит вам и подтвердит бронь.</p>}
          {open && r.deposit > 0 && <p className="rounded-xl bg-sand px-4 py-3 text-sm">{r.depositPaid ? `Депозит ${sum(r.deposit)} получен. При расчёте администратор учтёт его в счёте.` : `Депозит: ${sum(r.deposit)}. Деньги принимает администратор, он свяжется с вами.`}</p>}
          {r.location.phone && <p className="text-sm text-forest/70">Изменить бронь: <a className="underline" href={`tel:${r.location.phone}`}>{r.location.phone}</a></p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {open && r.startsAt.getTime() > nowMs() && <CancelBooking id={r.id} />}
          <Link href="/menu" className="text-sm font-bold underline underline-offset-4">Посмотреть меню</Link>
        </div>
      </div>
    </Page>
  );
}
