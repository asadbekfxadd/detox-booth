"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { askLocation, insideTelegram } from "@/lib/tg-client";
import { locateMeAction } from "@/app/(site)/actions";

const LS = "vb-geo-snooze";
const SNOOZE_MS = 7 * 24 * 3600_000;

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; text: string } | { kind: "closed" };

/**
 * Определение ближайшей точки. Полоса под шапкой, пока точку не выбрали: одна кнопка, без всплывающих окон при входе.
 * Если браузер уже разрешал место этому сайту, определяем сами. Место посетителя не сохраняется, запоминается только точка.
 */
export function AutoLocate({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [st, setSt] = useState<State>({ kind: "closed" });

  const run = async () => {
    setSt({ kind: "busy" });
    const g = await askLocation();
    if (!g.ok) {
      snooze();
      setSt({ kind: "done", text: g.reason === "denied" ? "Доступ к месту выключен в браузере. Выберите точку в шапке сайта." : "Не получилось определить место. Выберите точку в шапке сайта." });
      return;
    }
    const r = await locateMeAction(g.lat, g.lng);
    if ("error" in r) { setSt({ kind: "done", text: r.error }); return; }
    if (!r.nearest) { snooze(); setSt({ kind: "done", text: "Рядом с вами наших точек нет. Выберите точку в шапке сайта." }); return; }
    setSt({ kind: "done", text: `Ваша точка: ${r.nearest.name}, примерно ${r.nearest.label}. Меню показано для неё.` });
    router.refresh();
  };

  useEffect(() => {
    if (!enabled || insideTelegram()) return; // в Telegram место спрашивает приветствие Mini App
    try { const t = Number(localStorage.getItem(LS)); if (t && Date.now() - t < SNOOZE_MS) return; } catch { /* необязательно */ }
    let alive = true;
    (async () => {
      let granted = false;
      try { granted = (await navigator.permissions?.query({ name: "geolocation" }))?.state === "granted"; } catch { /* старый браузер */ }
      if (!alive) return;
      if (granted) void run(); else setSt({ kind: "idle" });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (st.kind === "closed") return null;
  return (
    <div className="border-b border-forest/10 bg-sand" role="status">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 text-sm">
        {st.kind === "idle" && <>
          <p className="font-bold text-forest-deep">Подскажем ближайшую к вам точку: меню и наличие покажем для неё.</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={run} className="btn btn-primary !px-4 !py-1.5 text-sm">Определить точку</button>
            <button type="button" onClick={() => { snooze(); setSt({ kind: "closed" }); }} className="text-forest/60 underline underline-offset-4 hover:text-forest">Не сейчас</button>
          </div>
        </>}
        {st.kind === "busy" && <p className="font-bold text-forest-deep">Определяем ближайшую точку…</p>}
        {st.kind === "done" && <>
          <p className="font-bold text-forest-deep">{st.text}</p>
          <button type="button" onClick={() => setSt({ kind: "closed" })} className="text-forest/60 underline underline-offset-4 hover:text-forest">Закрыть</button>
        </>}
      </div>
    </div>
  );
}

function snooze() { try { localStorage.setItem(LS, String(Date.now())); } catch { /* необязательно */ } }
