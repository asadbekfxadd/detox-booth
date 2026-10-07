"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setSiteLocation } from "@/app/(site)/actions";

export function LocationSelect({ locations, current }: { locations: { id: string; name: string }[]; current: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (locations.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-600">
      <span className="hidden sm:inline">📍 Точка</span>
      <select value={current ?? ""} disabled={pending} aria-label="Выбор точки"
        onChange={(e) => start(async () => { await setSiteLocation(e.target.value); router.refresh(); })}
        className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900">
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </label>
  );
}
