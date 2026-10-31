"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { locateMeAction, setSiteLocation } from "@/app/(site)/actions";
import { askLocation } from "@/lib/tg-client";

export function LocationSelect({ locations, current, locatable = false }: { locations: { id: string; name: string }[]; current: string | null; locatable?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (locations.length === 0) return null;

  async function locate() {
    setBusy(true); setNote(null);
    const g = await askLocation();
    if (!g.ok) { setBusy(false); setNote(g.reason === "denied" ? "Доступ к месту выключен в браузере. Выберите точку из списка." : "Не получилось определить место. Выберите точку из списка."); return; }
    const r = await locateMeAction(g.lat, g.lng);
    setBusy(false);
    if ("error" in r) { setNote(r.error); return; }
    if (!r.nearest) { setNote("Рядом с вами наших точек нет. Выберите точку из списка."); return; }
    setNote(`Ближайшая точка: ${r.nearest.name}, примерно ${r.nearest.label}.`);
    router.refresh();
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <label className="relative flex items-center">
        <span className="sr-only">Точка</span>
        <svg className="pointer-events-none absolute left-3 text-orange-deep" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
        <select value={current ?? ""} disabled={pending} aria-label="Выбор точки"
          onChange={(e) => start(async () => { setNote(null); await setSiteLocation(e.target.value); router.refresh(); })}
          className="max-w-[7.5rem] truncate rounded-full border border-forest/25 bg-white py-2.5 pl-9 pr-3 text-sm font-bold text-forest hover:border-forest/60 sm:max-w-none">
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      {locatable && (
        <button type="button" onClick={locate} disabled={busy} aria-label="Определить ближайшую точку" title="Определить ближайшую точку" data-locate
          className="grid size-10 shrink-0 place-items-center rounded-full border border-forest/25 bg-white text-forest hover:border-forest/60 disabled:opacity-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className={busy ? "animate-pulse" : ""}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
        </button>
      )}
      {note && (
        <p role="status" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl bg-white p-3 text-sm font-semibold text-forest-deep shadow-lg ring-1 ring-forest/10">
          {note} <button type="button" onClick={() => setNote(null)} className="ml-1 text-forest/60 underline underline-offset-4">Закрыть</button>
        </p>
      )}
    </div>
  );
}
