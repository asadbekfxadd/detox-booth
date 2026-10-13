import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { bookingConfig } from "@/services/reservations";
import { tashkentDay, nowMs } from "@/lib/time";
import { BookingForm } from "@/components/site/BookingForm";
import { Page } from "@/components/site/Page";

export const metadata = { title: "Бронь стола" };
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const [{ current }, cfg] = await Promise.all([getSiteLocation(), bookingConfig()]);
  const now = nowMs();
  return (
    <Page className="space-y-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <h1 className="text-3xl font-extrabold">Бронь стола</h1>
        {!cfg.enabled || !current
          ? (
            <div className="rounded-2xl bg-white p-8 pop">
              <p className="font-bold">Онлайн-бронь сейчас недоступна.</p>
              <p className="mt-1 text-sm text-forest/70">{current?.phone ? <>Позвоните нам: <a className="underline" href={`tel:${current.phone}`}>{current.phone}</a>.</> : "Позвоните в заведение."}</p>
              <Link href="/menu" className="btn btn-primary pop mt-4 inline-block">В меню</Link>
            </div>
          )
          : <BookingForm locationName={current.name} minDay={tashkentDay(now)} maxDay={tashkentDay(now + cfg.maxDays * 86400000)} maxGuests={cfg.maxGuests} depositPerGuest={cfg.depositPerGuest} autoConfirm={cfg.autoConfirm} />}
      </div>
    </Page>
  );
}
