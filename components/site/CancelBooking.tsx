"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelBookingAction } from "@/app/(site)/actions";

export function CancelBooking({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    if (!window.confirm("Отменить бронь?")) return;
    setBusy(true); setError(null);
    const r = await cancelBookingAction(id);
    setBusy(false);
    if ("error" in r) setError(r.error); else router.refresh();
  }
  return (
    <div className="space-y-2">
      <button onClick={run} disabled={busy} className="rounded-xl border border-forest/25 px-5 py-2.5 text-sm font-bold hover:bg-sand disabled:opacity-60">{busy ? "Отменяем…" : "Отменить бронь"}</button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
