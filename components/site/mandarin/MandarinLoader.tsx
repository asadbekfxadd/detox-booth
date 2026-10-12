"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Помощница нужна не в первую секунду: подгружаем её код, когда браузер освободился, чтобы не тормозить открытие страницы.
const MandarinAssistant = dynamic(() => import("./MandarinAssistant").then((m) => m.MandarinAssistant), { ssr: false });

export function MandarinLoader() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const go = () => setReady(true);
    // Safari до недавних версий не знает requestIdleCallback, поэтому тип расширяем вручную
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(go, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(go, 1500);
    return () => window.clearTimeout(t);
  }, []);
  return ready ? <MandarinAssistant /> : null;
}
