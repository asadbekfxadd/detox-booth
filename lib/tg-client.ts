/** Работа с Telegram Mini App на стороне браузера. Вне Telegram ничего не загружается и не делается. */
type TgWebApp = {
  initData: string; ready: () => void; expand: () => void; close: () => void;
  setHeaderColor?: (c: string) => void; setBackgroundColor?: (c: string) => void; disableVerticalSwipes?: () => void;
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
