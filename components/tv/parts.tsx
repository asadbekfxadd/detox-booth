"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type BrandInfo = { word: [string, string]; descriptor: string; logoUrl: string; initial: string; ticker: string[]; tagline: string };

export const num = (n: number) => Math.round(n).toLocaleString("ru-RU");

// пузырьки: положение по ширине, размер (u), секунд на подъём, задержка
const BUBBLES: [string, number, number, number][] = [["6%", 3, 26, 0], ["14%", 1.8, 19, 7], ["27%", 4.4, 32, 12], ["41%", 2.2, 22, 3], ["55%", 3.4, 28, 16], ["68%", 1.6, 18, 9], ["79%", 4, 34, 5], ["90%", 2.6, 24, 14], ["96%", 1.4, 17, 1]];

/** Общая «жизнь» экрана: часы, обновление данных раз в 90 секунд (пустой экран чаще) и запрет гашения экрана. */
export function useTvLifecycle(empty: boolean): string {
  const router = useRouter();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const refresh = () => router.refresh();
    const t = setInterval(refresh, empty ? 30_000 : 90_000);
    const vis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [router, empty]);

  useEffect(() => {
    const fmt = () => setClock(new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" }).format(new Date()));
    fmt();
    const t = setInterval(fmt, 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    let lock: Lock | null = null;
    const get = async () => { try { lock = await (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock?.request("screen") ?? null; } catch { /* не поддерживается */ } };
    void get();
    const vis = () => { if (document.visibilityState === "visible") void get(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); void lock?.release().catch(() => {}); };
  }, []);

  return clock;
}

export function TvBubbles() {
  return (
    <div className="tv-bubbles" aria-hidden>
      {BUBBLES.map(([x, s, d, delay]) => <i key={x} style={{ "--x": x, "--s": s, "--d": `${d}s`, "--delay": `-${delay}s` } as React.CSSProperties} />)}
    </div>
  );
}

/** Верх экрана: знак, середина (категории или заголовок), точка и время. */
export function TvHeader({ brand, locationName, clock, children }: { brand: BrandInfo; locationName: string; clock: string; children?: React.ReactNode }) {
  return (
    <header className="tv-top">
      <div className="tv-logo">
        {brand.logoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={brand.logoUrl} alt="" />
          : <span className="tv-mono" aria-hidden>{brand.initial}</span>}
        <span className="tv-word">
          <b>{brand.word[0]}{brand.word[1] && <> <i>{brand.word[1]}</i></>}</b>
          {brand.descriptor && <small>{brand.descriptor}</small>}
        </span>
      </div>
      {children ?? <div style={{ flex: 1 }} />}
      <div className="tv-meta">
        {locationName && (
          <span className="tv-where">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            {locationName}
          </span>
        )}
        <span className="tv-clock" suppressHydrationWarning>{clock}</span>
      </div>
    </header>
  );
}

/** Низ экрана: волна цвета напитка, бегущая строка (или слоган) и QR. */
export function TvFooter({ brand, qr }: { brand: BrandInfo; qr: string }) {
  return (
    <footer className="tv-foot">
      <span className="tv-wave" aria-hidden />
      {brand.ticker.length > 0
        ? <div className="tv-ticker" aria-hidden>
            <div className="tv-ticker-track">
              {["a", "b"].map((k) => <ul key={k}>{brand.ticker.map((t) => <li key={t}>{t}</li>)}</ul>)}
            </div>
          </div>
        : <p className="tv-tag">{brand.tagline}</p>}
      <div className="tv-order">
        <p>Закажите с телефона<span>Наведите камеру на код</span></p>
        <div className="tv-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR-код меню" />
        </div>
      </div>
    </footer>
  );
}
