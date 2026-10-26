"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { askContact, askLocation, getInitData, openLocationSettings } from "@/lib/tg-client";
import { setSiteLocation, tgPrefillAction, tgSaveLocationAction } from "@/app/(site)/actions";

const LS = "vb-tg-welcome";
const SNOOZE_MS = 3 * 24 * 3600_000;

/** Внутри Telegram при входе предлагает поделиться номером и местом. Не блокирует меню; всё по нажатию кнопки. */
export function TelegramWelcome({ currentId }: { currentId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [need, setNeed] = useState({ phone: false, geo: false });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"phone" | "geo" | null>(null);
  const initRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await getInitData();
      if (!d || !alive) return;
      initRef.current = d;
      try { const t = Number(localStorage.getItem(LS)); if (t && Date.now() - t < SNOOZE_MS) return; } catch { /* необязательно */ }
      const p = await tgPrefillAction(d);
      if (!alive || !p) return;
      if (!p.hasPhone || !p.hasGeo) { setNeed({ phone: !p.hasPhone, geo: !p.hasGeo }); setOpen(true); }
    })();
    return () => { alive = false; };
  }, []);

  const snooze = () => { try { localStorage.setItem(LS, String(Date.now())); } catch { /* необязательно */ } setOpen(false); };

  async function sharePhone() {
    setBusy("phone"); setMsg(null);
    const ok = await askContact();
    if (!ok) { setBusy(null); setMsg("Эта версия Telegram не умеет делиться номером из приложения. Нажмите «Поделиться номером» в чате с ботом или впишите номер при заказе."); return; }
    // номер приходит боту, а не сайту: ждём, пока бот его сохранит
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const p = await tgPrefillAction(initRef.current);
      if (p?.hasPhone) { setNeed((n) => ({ ...n, phone: false })); setBusy(null); setMsg("Номер сохранён. Спасибо!"); router.refresh(); return; }
    }
    setBusy(null); setMsg("Номер пока не получили. Если вы отказались, ничего страшного: впишите его при заказе.");
  }

  async function shareGeo() {
    setBusy("geo"); setMsg(null);
    const g = await askLocation();
    if (!g.ok) {
      setBusy(null);
      setMsg(g.reason === "denied" ? "Доступ к месту выключен. Разрешите его в настройках Telegram или выберите точку вручную в шапке сайта." : "Не получилось определить место. Выберите точку вручную в шапке сайта.");
      if (g.reason === "denied") void openLocationSettings();
      return;
    }
    const r = await tgSaveLocationAction(initRef.current, g.lat, g.lng);
    setBusy(null);
    if ("error" in r) { setMsg(r.error); return; }
    setNeed((n) => ({ ...n, geo: false }));
    if (r.nearest) {
      if (r.nearest.id !== currentId) { await setSiteLocation(r.nearest.id); router.refresh(); }
      setMsg(`Ближайшая точка: ${r.nearest.name}, примерно ${r.nearest.label}. Выбрали её для вас.`);
    } else setMsg("Место сохранили. Точку выберите в шапке сайта.");
  }

  if (!open) return null;
  const done = !need.phone && !need.geo;
  return (
    <div role="dialog" aria-label="Знакомство" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="pop mx-auto max-w-md space-y-3 rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">{done ? "Готово" : "Давайте познакомимся"}</h2>
        {!done && <p className="text-sm text-forest/70">Номер ускорит заказ и привяжет баллы, а место подскажет ближайшую точку и поможет курьеру. Это не обязательно, меню открыто и так.</p>}
        <div className="flex flex-col gap-2">
          {need.phone && <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={sharePhone}>{busy === "phone" ? "Ждём ответ Telegram…" : "Поделиться номером"}</button>}
          {need.geo && <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={shareGeo}>{busy === "geo" ? "Определяем…" : "Определить, где я"}</button>}
          <button type="button" className="rounded-full px-4 py-2 text-sm font-bold text-forest/70 hover:bg-sand" onClick={snooze}>{done ? "Закрыть" : "Не сейчас"}</button>
        </div>
        {msg && <p role="status" className="text-sm font-semibold text-forest-deep">{msg}</p>}
        {!done && <p className="pr-16 text-xs text-forest/50">Место хранится приблизительно (до ~100 м) и видно только нашим сотрудникам. Используем его для подсказки точки и, если вы разрешите, для доставки.</p>}
      </div>
    </div>
  );
}
