"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadTelegram } from "@/lib/tg-client";

/** Внутри Telegram: разворачивает приложение, красит шапку под бренд и включает кнопку «Назад». Снаружи ничего не делает. */
export function TelegramApp() {
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    loadTelegram().then((wa) => {
      if (!alive || !wa) return;
      document.documentElement.classList.add("tg");
      wa.ready(); wa.expand();
      try { wa.disableVerticalSwipes?.(); } catch { /* старые клиенты */ }
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-cream").trim();
      if (/^#[0-9a-f]{6}$/i.test(bg)) { wa.setHeaderColor?.(bg); wa.setBackgroundColor?.(bg); }
      const back = wa.BackButton;
      if (!back) return;
      const go = () => router.back();
      if (path === "/") back.hide(); else { back.show(); back.onClick(go); off = () => back.offClick(go); }
    });
    return () => { alive = false; off?.(); };
  }, [path, router]);

  return null;
}
