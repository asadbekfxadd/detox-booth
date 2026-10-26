/** Работа с Telegram Mini App на стороне браузера. Вне Telegram ничего не загружается и не делается. */
type TgWebApp = {
  initData: string; ready: () => void; expand: () => void; close: () => void;
  setHeaderColor?: (c: string) => void; setBackgroundColor?: (c: string) => void; disableVerticalSwipes?: () => void;
  version?: string; isVersionAtLeast?: (v: string) => boolean;
  requestContact?: (cb?: (shared: boolean) => void) => void;
  LocationManager?: {
    isInited: boolean; isLocationAvailable: boolean; isAccessRequested: boolean; isAccessGranted: boolean;
    init: (cb?: () => void) => void;
    getLocation: (cb: (d: { latitude: number; longitude: number } | null) => void) => void;
    openSettings: () => void;
  };
  BackButton?: { show: () => void; hide: () => void; onClick: (f: () => void) => void; offClick: (f: () => void) => void };
};
declare global { interface Window { Telegram?: { WebApp?: TgWebApp } } }

const SCRIPT = "https://telegram.org/js/telegram-web-app.js";
let loading: Promise<TgWebApp | null> | null = null;

/** Telegram передаёт параметры в адресе (#tgWebAppData) и запоминает их в sessionStorage: так узнаём, что мы внутри Mini App. */
export function insideTelegram(): boolean {
  try {
    if (/tgWebApp/i.test(location.hash)) return true;
    if (sessionStorage.getItem("__telegram__initParams")) return true;
  } catch { /* sessionStorage недоступен */ }
  return false;
}

export function loadTelegram(): Promise<TgWebApp | null> {
  if (typeof window === "undefined" || !insideTelegram()) return Promise.resolve(null);
  loading ??= new Promise((resolve) => {
    const done = () => resolve(window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : null);
    if (window.Telegram?.WebApp) { done(); return; }
    const s = document.createElement("script");
    s.src = SCRIPT; s.async = true; s.onload = done; s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(done, 6000);
  });
  return loading;
}

/** Подписанные данные пользователя для сервера; null вне Telegram */
export async function getInitData(): Promise<string | null> {
  return (await loadTelegram())?.initData || null;
}

/** Просит Telegram передать боту подтверждённый номер. Возвращает false, если клиент слишком старый. */
export async function askContact(): Promise<boolean> {
  const wa = await loadTelegram();
  if (!wa?.requestContact || (wa.isVersionAtLeast && !wa.isVersionAtLeast("6.9"))) return false;
  return new Promise((resolve) => {
    let done = false;
    const fin = (v: boolean) => { if (!done) { done = true; resolve(v); } };
    try { wa.requestContact!((shared) => fin(!!shared)); } catch { fin(false); }
    setTimeout(() => fin(true), 60_000);
  });
}

export type GeoResult = { ok: true; lat: number; lng: number } | { ok: false; reason: "denied" | "unavailable" };

/** Геопозиция: сначала нативный запрос Telegram (Bot API 8.0), иначе браузерный. Спрашивает только по нажатию кнопки. */
export async function askLocation(): Promise<GeoResult> {
  const wa = await loadTelegram();
  const lm = wa?.LocationManager;
  if (lm) {
    const ready = await new Promise<boolean>((res) => { try { lm.isInited ? res(true) : lm.init(() => res(true)); } catch { res(false); } setTimeout(() => res(false), 5000); });
    if (ready && lm.isLocationAvailable) {
      const d = await new Promise<{ latitude: number; longitude: number } | null>((res) => { try { lm.getLocation(res); } catch { res(null); } setTimeout(() => res(null), 30_000); });
      if (d) return { ok: true, lat: d.latitude, lng: d.longitude };
      return { ok: false, reason: "denied" };
    }
  }
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    return new Promise((res) => navigator.geolocation.getCurrentPosition(
      (p) => res({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => res({ ok: false, reason: e.code === 1 ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
    ));
  }
  return { ok: false, reason: "unavailable" };
}

export async function openLocationSettings() { try { (await loadTelegram())?.LocationManager?.openSettings(); } catch { /* старый клиент */ } }
