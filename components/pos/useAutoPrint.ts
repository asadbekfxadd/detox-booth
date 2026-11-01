"use client";
import { useSyncExternalStore } from "react";
import { autoPrintOn, POS_AUTOPRINT_KEY } from "@/lib/auto-print";

const EVT = "pos-autoprint";
const read = () => { try { return localStorage.getItem(POS_AUTOPRINT_KEY); } catch { return null; } };
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };

/** Переключатель «печатать чек сразу после оплаты»: помнится на этом компьютере, по умолчанию включён. */
export function useAutoPrint(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => autoPrintOn(read()), () => true);
  const set = (v: boolean) => {
    try { localStorage.setItem(POS_AUTOPRINT_KEY, v ? "1" : "0"); } catch { /* приватный режим: выбор не запомнится */ }
    window.dispatchEvent(new Event(EVT));
  };
  return [on, set];
}
