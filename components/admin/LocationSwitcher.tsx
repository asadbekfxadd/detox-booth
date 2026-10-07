"use client";
import { useTransition } from "react";
import { setLocation } from "@/app/admin/actions";

export function LocationSwitcher({ locations, current }: { locations: { id: string; name: string }[]; current: string | null }) {
  const [pending, start] = useTransition();
  return (
    <select value={current ?? "all"} disabled={pending}
      onChange={(e) => start(() => setLocation(e.target.value))}
      className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm">
      <option value="all">Все точки</option>
      {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  );
}
