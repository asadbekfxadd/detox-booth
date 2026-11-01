"use client";
import { receiptPath } from "@/lib/auto-print";

/** В приложении для Windows (папка desktop/) окно даёт тихую печать на принтер по умолчанию. */
type Desktop = { printUrl: (path: string) => Promise<{ ok: boolean; error?: string }> };
declare global { interface Window { vitaminbDesktop?: Desktop } }

export type PrintResult = { ok: true; via: "desktop" | "browser" } | { ok: false; error: string };

/**
 * Печатает чек заказа сразу, без кнопок «скачать» и «распечатать».
 * В приложении для Windows печать тихая. В браузере чек открывается в скрытой рамке и вызывает печать:
 * диалог не появится, если Chrome запущен с флагом --kiosk-printing (см. README).
 */
export async function printReceipt(orderId: string): Promise<PrintResult> {
  const desktop = typeof window !== "undefined" ? window.vitaminbDesktop : undefined;
  if (desktop) {
    try {
      const r = await desktop.printUrl(receiptPath(orderId, false));
      return r.ok ? { ok: true, via: "desktop" } : { ok: false, error: r.error || "Принтер не ответил" };
    } catch { return { ok: false, error: "Принтер не ответил" }; }
  }
  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  f.src = receiptPath(orderId, true);
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 60_000);
  return { ok: true, via: "browser" };
}
