"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseVideo } from "@/lib/video";
import type { HeroVideo as Item } from "@/lib/brand-config";
import { HowItsMade } from "./HowItsMade";

const round = "grid size-9 place-items-center rounded-full bg-forest-deep/80 text-white shadow backdrop-blur transition-transform hover:scale-110 focus-visible:scale-110";

/**
 * Видео «как готовим» в первом экране. Прямые файлы играют сами, без звука, по очереди (одно видео крутится по кругу).
 * Не тратим трафик зря: ролик начинает грузиться и играть, только когда карточка на экране, и ставится на паузу, когда её не видно
 * или вкладка в фоне. При «уменьшении движения» и в режиме экономии трафика автозапуска нет: гость нажимает «играть» сам.
 * Есть кнопки паузы и звука. Если ролик не загрузился, он пропускается. YouTube открывается по нажатию, как и в карточке продукта.
 */
export function HeroVideo({ videos, tall = false, className = "" }: { videos: Item[]; tall?: boolean; className?: string }) {
  const items = useMemo(() => videos.map((v) => ({ v: parseVideo(v.url), url: v.url, title: v.title })).filter((x) => x.v), [videos]);
  const files = useMemo(() => items.flatMap((x) => (x.v!.kind === "file" ? [{ src: x.v!.src, title: x.title }] : [])), [items]);
  const other = items.find((x) => x.v!.kind !== "file");
  const [cur, setCur] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [inView, setInView] = useState(false);
  const [hidden, setHidden] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);

  const list = files.filter((f) => !failed.includes(f.src));
  const at = list.length ? cur % list.length : 0;
  const now = list[at];

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (still) queueMicrotask(() => setPaused(true));
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    const vis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, []);

  const playing = !paused && inView && !hidden;
  useEffect(() => {
    const el = vid.current;
    if (!el || !now) return;
    // ошибка загрузки могла случиться до гидратации страницы: событие error уже прошло, поэтому смотрим состояние сами
    if (el.error) { queueMicrotask(() => setFailed((f) => (f.includes(now.src) ? f : [...f, now.src]))); return; }
    if (playing) el.play().catch(() => { /* браузер не разрешил автозапуск: останется кнопка «играть» */ });
    else el.pause();
  }, [playing, now]);

  if (!now && !other) return null;
  const shell = `arch-rise relative ${tall ? "row-span-2 self-start" : ""} ${className}`;
  const frame = `relative overflow-hidden rounded-[1.75rem] border-4 border-white bg-forest-deep shadow-[0_24px_50px_-24px_rgba(7,45,23,0.55)] ${tall ? "aspect-[3/4]" : "aspect-square"}`;

  if (!now && other) {
    return (
      <div ref={root} className={shell}>
        <div className={`${frame} bg-[radial-gradient(circle_at_30%_25%,#ffd25a,#ff9a1a_60%,#ff7a00)]`}>
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            <div className="space-y-3">
              <p className="display text-xl font-black leading-tight text-forest-deep sm:text-2xl">{other.title || "Так мы готовим"}</p>
              <HowItsMade url={other.url} name={other.title || "Так готовим"} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className={shell}>
      <div className={frame}>
        <video ref={vid} key={now.src} src={now.src} muted={muted} playsInline preload="metadata" loop={list.length === 1}
          aria-label={now.title || "Как готовим"} className="absolute inset-0 size-full object-cover"
          onEnded={() => setCur((c) => c + 1)}
          onError={() => setFailed((f) => (f.includes(now.src) ? f : [...f, now.src]))} />
        {list.length > 1 && (
          <div className="absolute bottom-[3.4rem] left-3 right-14 flex gap-1.5" role="group" aria-label="Видео">
            {list.map((f, i) => (
              <button key={f.src} type="button" aria-label={`Видео ${i + 1} из ${list.length}`} aria-current={i === at} onClick={() => setCur(i)}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i === at ? "bg-white" : "bg-white/40 hover:bg-white/70"}`} />
            ))}
          </div>
        )}
        <span className="display absolute bottom-3 left-3 right-14 truncate rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold leading-tight text-forest shadow sm:text-xs">
          Так готовим{now.title ? <>: <span className="text-orange-deep">{now.title}</span></> : null}
        </span>
        <div className="absolute bottom-2 right-2 flex flex-col gap-1.5">
          <button type="button" className={round} aria-pressed={!muted} aria-label={muted ? "Включить звук" : "Выключить звук"} onClick={() => setMuted((m) => !m)}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H3v6h3l5 4z" />{muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M16 9a4 4 0 0 1 0 6m2.5-8.5a8 8 0 0 1 0 11" />}
            </svg>
          </button>
          <button type="button" className={round} aria-pressed={paused} aria-label={paused ? "Играть" : "Пауза"} onClick={() => setPaused((p) => !p)}>
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>{paused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h4v14H7zm6 0h4v14h-4z" />}</svg>
          </button>
        </div>
      </div>
    </div>
  );
}
