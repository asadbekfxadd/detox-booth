"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setSiteLocation } from "@/app/(site)/actions";

export function LocationSelect({ locations, current }: { locations: { id: string; name: string }[]; current: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (locations.length === 0) return null;
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Точка</span>
      <svg className="pointer-events-none absolute left-3 text-neon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
      <select value={current ?? ""} disabled={pending} aria-label="Выбор точки"
        onChange={(e) => start(async () => { await setSiteLocation(e.target.value); router.refresh(); })}
        className="max-w-[9.5rem] truncate rounded-xl border border-white/20 bg-surface py-2.5 pl-9 pr-3 text-sm font-bold text-white hover:border-white/50 sm:max-w-none">
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </label>
  );
}
