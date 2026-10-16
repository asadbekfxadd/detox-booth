"use client";
import { useRef, useState } from "react";
import { parseVideo } from "@/lib/video";

const btn = "inline-flex items-center gap-2 rounded-full bg-forest-deep/90 px-4 py-2 text-sm font-extrabold text-white shadow-lg backdrop-blur transition-transform hover:scale-105 focus-visible:scale-105";

const Play = () => (
  <span aria-hidden className="grid size-6 place-items-center rounded-full bg-orange text-forest-deep">
    <svg viewBox="0 0 24 24" className="size-3.5 translate-x-px" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  </span>
);

/**
 * Кнопка «Как готовим» поверх фото. Видео не грузится, пока гость не нажал: страница остаётся быстрой.
 * Файл играет в нашем плеере (без звука, со звуком по желанию), YouTube — во встроенном, остальное открывается в новой вкладке.
 */
export function HowItsMade({ url, name, poster, className = "" }: { url: string; name: string; poster?: string | null; className?: string }) {
  const v = parseVideo(url);
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  if (!v) return null;
  if (v.kind === "link") {
    return <a href={v.src} target="_blank" rel="noopener noreferrer" className={`${btn} ${className}`}><Play />Как готовим</a>;
  }
  const close = () => ref.current?.close();
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); ref.current?.showModal(); }} aria-haspopup="dialog" className={`${btn} ${className}`}><Play />Как готовим</button>
      <dialog ref={ref} aria-label={`Как готовим: ${name}`} onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === ref.current) close(); }}
        className="m-auto max-h-[92dvh] max-w-[min(94vw,760px)] overflow-hidden rounded-2xl bg-black p-0 text-white backdrop:bg-black/75">
        {open && (
          <div className="relative">
            <button type="button" onClick={close} aria-label="Закрыть видео" className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-black/60 text-xl font-black leading-none hover:bg-black">×</button>
            {v.kind === "file" ? (
              <video src={v.src} poster={poster ?? undefined} controls autoPlay muted loop playsInline preload="metadata" className="max-h-[88dvh] w-full bg-black" />
            ) : (
              <iframe src={v.embed} title={`Как готовим: ${name}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
                style={v.vertical ? { aspectRatio: "9 / 16", height: "min(86dvh, 680px)", maxWidth: "92vw" } : { aspectRatio: "16 / 9", width: "min(94vw, 760px)" }} className="block border-0" />
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
