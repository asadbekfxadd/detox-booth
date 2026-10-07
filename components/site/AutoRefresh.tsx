"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Обновляет страницу заказа, пока он не завершён. */
export function AutoRefresh({ active, everyMs = 15000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs, router]);
  return null;
}
