"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bookingSlotsAction, bookTableAction } from "@/app/(site)/actions";
import { sum } from "@/lib/format";

const field = "w-full rounded-xl border border-forest/20 bg-white px-4 py-3 text-sm font-medium text-forest outline-none placeholder:text-forest/45 focus:border-orange";

export function BookingForm({ locationName, minDay, maxDay, maxGuests, depositPerGuest, autoConfirm }: {
  locationName: string; minDay: string; maxDay: string; maxGuests: number; depositPerGuest: number; autoConfirm: boolean;
}) {
  const router = useRouter();
  const [day, setDay] = useState(minDay);
  const [guests, setGuests] = useState(2);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [slots, setSlots] = useState<{ time: string; free: boolean }[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    // setState до await лишний: сбрасываем выбор времени в обработчиках, а здесь только загрузка
    bookingSlotsAction(day, guests).then((r) => {
      if (!alive) return;
      if ("error" in r) { setLoadErr(r.error); setSlots(null); } else { setLoadErr(null); setSlots(r.slots); setTime((t) => (r.slots.some((s) => s.time === t && s.free) ? t : "")); }
    });
    return () => { alive = false; };
  }, [day, guests]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    if (!time) { setError("Выберите время"); return; }
    lock.current = true; setBusy(true); setError(null);
    try {
      const r = await bookTableAction({ name, phone, guests, day, time, note: note || undefined });
      if ("error" in r) { setError(r.error); return; }
      router.push(`/book/${r.id}`);
    } finally { lock.current = false; setBusy(false); }
  }

  const free = slots?.filter((s) => s.free) ?? [];
  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-3 rounded-2xl bg-white p-5 pop">
        <h2 className="font-bold">Когда придёте</h2>
        <p className="text-sm text-forest/60">Точка: <b>{locationName}</b>. Сменить точку можно в шапке сайта.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block text-forest/70">Дата</span>
            <input type="date" className={field} value={day} min={minDay} max={maxDay} onChange={(e) => { setDay(e.target.value); setTime(""); }} required /></label>
          <label className="block text-sm"><span className="mb-1 block text-forest/70">Гостей</span>
            <input type="number" className={field} value={guests} min={1} max={maxGuests} onChange={(e) => { setGuests(Math.max(1, Math.min(maxGuests, Number(e.target.value) || 1))); setTime(""); }} required /></label>
        </div>
        <div role="group" aria-label="Время" className="flex flex-wrap gap-2">
          {slots === null && !loadErr && <p className="text-sm text-forest/60">Ищем свободное время…</p>}
          {loadErr && <p role="alert" className="text-sm text-red-700">{loadErr}</p>}
          {slots?.map((s) => (
            <button type="button" key={s.time} disabled={!s.free} aria-pressed={time === s.time} onClick={() => setTime(s.time)}
              className={`rounded-full border px-4 py-2 text-sm font-bold ${time === s.time ? "border-forest bg-forest text-white" : s.free ? "border-forest/25 bg-white hover:border-forest" : "border-forest/10 bg-forest/5 text-forest/35 line-through"}`}>{s.time}</button>
          ))}
        </div>
        {slots && free.length === 0 && <p className="text-sm font-semibold text-orange-deep">На этот день нет свободных столов для {guests} гост. Выберите другую дату или позвоните нам.</p>}
      </section>
      <section className="space-y-3 rounded-2xl bg-white p-5 pop">
        <h2 className="font-bold">Ваши данные</h2>
        <input className={field} aria-label="Имя" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={60} />
        <input className={field} aria-label="Телефон" placeholder="Телефон, например +998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" required />
        <textarea className={field} aria-label="Комментарий" placeholder="Пожелания: детский стул, у окна… (необязательно)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} />
        {depositPerGuest > 0 && <p className="rounded-xl bg-sand px-4 py-3 text-sm">Для брони нужен депозит {sum(depositPerGuest)} с гостя: {sum(depositPerGuest * guests)} за {guests} гост. Деньги принимает администратор, он свяжется с вами. При расчёте администратор учтёт депозит в счёте.</p>}
        {!autoConfirm && <p className="text-sm text-forest/60">Администратор позвонит вам и подтвердит бронь.</p>}
      </section>
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button disabled={busy || !time} className="btn btn-primary pop w-full">{busy ? "Бронируем…" : time ? `Забронировать на ${time}` : "Выберите время"}</button>
    </form>
  );
}
