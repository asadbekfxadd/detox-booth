"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Живые фрукты вокруг фото на главной: падают при загрузке, плавают, слегка следуют за курсором,
 * а если на фрукт нажать, он лопается брызгами сока и через секунду вырастает снова.
 * Чисто декоративно: скрыто от скринридеров, на клавиатуру не реагирует. Двигаются только transform и translate (без перерисовки).
 */
type Kind = "orange" | "lemon" | "lime" | "kiwi" | "berry";

const FRUITS: { kind: Kind; box: string; size: string; depth: number; rot: number; delay: number; juice: string; hideOnPhone?: boolean }[] = [
  { kind: "orange", box: "-left-3 top-2 sm:-left-2 sm:top-6", size: "size-16 sm:size-24 lg:size-28", depth: 26, rot: -12, delay: 0.55, juice: "#ff9a1a" },
  { kind: "lemon", box: "left-[44%] -top-3 sm:-top-6", size: "size-11 sm:size-16", depth: -16, rot: 18, delay: 0.75, juice: "#ffd23f", hideOnPhone: true },
  { kind: "berry", box: "-left-2 bottom-[9%] sm:-left-8 sm:bottom-[7%]", size: "size-14 sm:size-20 lg:size-24", depth: 20, rot: -8, delay: 0.95, juice: "#ff4d5e" },
  { kind: "kiwi", box: "-right-2 -bottom-12 sm:-right-12 sm:-bottom-14", size: "size-16 sm:size-24 lg:size-28", depth: -24, rot: 10, delay: 1.15, juice: "#8ccf3e" },
  { kind: "lime", box: "-left-3 top-[44%] sm:-left-8", size: "size-10 sm:size-14", depth: 14, rot: 22, delay: 1.35, juice: "#7fd14a", hideOnPhone: true },
];

const DROPS = Array.from({ length: 9 }, (_, k) => {
  const a = ((k * 40 + (k % 2 ? 14 : -10)) * Math.PI) / 180, d = 46 + ((k * 17) % 30);
  return { tx: Math.round(Math.cos(a) * d), ty: Math.round(Math.sin(a) * d) };
});
const NOTES = ["Ммм!", "Свежо!", "Вкусно!", "Ещё!", "Сочно!"];

function Slice({ rim, pith, flesh, segs = 8 }: { rim: string; pith: string; flesh: string; segs?: number }) {
  return (
    <svg viewBox="0 0 100 100" className="size-full">
      <circle cx="50" cy="50" r="47" fill={rim} />
      <circle cx="50" cy="50" r="42" fill={pith} />
      <circle cx="50" cy="50" r="38" fill={flesh} />
      <g stroke={pith} strokeWidth="3" strokeLinecap="round">
        {Array.from({ length: segs }, (_, k) => <line key={k} x1="50" y1="50" x2="50" y2="15" transform={`rotate(${(360 / segs) * k} 50 50)`} />)}
      </g>
      <circle cx="50" cy="50" r="4.5" fill={pith} />
      <path d="M22 38a30 30 0 0 1 18-16" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function Kiwi() {
  return (
    <svg viewBox="0 0 100 100" className="size-full">
      <circle cx="50" cy="50" r="47" fill="#8a6a35" />
      <circle cx="50" cy="50" r="42" fill="#8ccf3e" />
      <g stroke="#b4e26a" strokeWidth="2.5" strokeLinecap="round">
        {Array.from({ length: 12 }, (_, k) => <line key={k} x1="50" y1="30" x2="50" y2="14" transform={`rotate(${30 * k} 50 50)`} />)}
      </g>
      <circle cx="50" cy="50" r="15" fill="#f1f7c8" />
      <g fill="#1d2a14">
        {Array.from({ length: 14 }, (_, k) => <ellipse key={k} cx="50" cy="29" rx="1.8" ry="3" transform={`rotate(${(360 / 14) * k} 50 50)`} />)}
      </g>
      <path d="M22 38a30 30 0 0 1 18-16" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function Berry() {
  return (
    <svg viewBox="0 0 100 100" className="size-full">
      <path d="M50 94C20 72 8 50 16 33c7-14 25-14 34-5 9-9 27-9 34 5 8 17-4 39-34 61z" fill="#ef3b4a" />
      <ellipse cx="34" cy="40" rx="7" ry="11" fill="#fff" opacity=".22" transform="rotate(20 34 40)" />
      <g fill="#ffe08a">
        {[[34, 50], [50, 46], [66, 50], [40, 64], [58, 64], [50, 78], [28, 38], [72, 38]].map(([x, y], k) => <ellipse key={k} cx={x} cy={y} rx="1.8" ry="2.8" />)}
      </g>
      <path d="M50 30 38 14l10 6 2-13 3 13 10-6z" fill="#3aa04a" />
    </svg>
  );
}

function Art({ kind }: { kind: Kind }) {
  if (kind === "orange") return <Slice rim="#ff8a00" pith="#fff3d6" flesh="#ffa726" />;
  if (kind === "lemon") return <Slice rim="#f2c200" pith="#fff8c9" flesh="#ffe14d" />;
  if (kind === "lime") return <Slice rim="#3f9b2f" pith="#eaf7c8" flesh="#8fd14f" segs={10} />;
  if (kind === "kiwi") return <Kiwi />;
  return <Berry />;
}

export function HeroFruits() {
  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [popped, setPopped] = useState<Record<number, number>>({});
  const [taps, setTaps] = useState(0);

  // Мягкий параллакс от курсора: только на устройствах с мышью, без «уменьшения движения», и только пока первый экран виден.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, visible = true, lx = 0, ly = 0;
    const apply = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (lx - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      const ny = Math.max(-1, Math.min(1, (ly - (r.top + r.height / 2)) / (window.innerHeight / 2)));
      el.style.setProperty("--px", nx.toFixed(3));
      el.style.setProperty("--py", ny.toFixed(3));
    };
    const move = (e: PointerEvent) => { lx = e.clientX; ly = e.clientY; if (visible && !raf) raf = requestAnimationFrame(apply); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const pop = (i: number) => {
    if (popped[i]) return;
    setPopped((p) => ({ ...p, [i]: Date.now() }));
    setTaps((n) => n + 1);
    timers.current.push(window.setTimeout(() => setPopped((p) => { const n = { ...p }; delete n[i]; return n; }), 1700));
  };

  return (
    <div ref={root} aria-hidden className="hf pointer-events-none absolute inset-0 z-20">
      {FRUITS.map((f, i) => {
        const on = popped[i] != null;
        return (
          <div key={f.kind} className={`absolute ${f.box} ${f.hideOnPhone ? "hidden sm:block" : ""}`} style={{ ["--d" as string]: f.depth }}>
            <div className="hf-par">
              <div className="hf-in" style={{ animationDelay: `${f.delay}s` }}>
                <div className="hf-float" style={{ ["--r" as string]: `${f.rot}deg`, animationDelay: `${-i * 1.3}s` }}>
                  <span role="presentation" onPointerDown={() => pop(i)} className={`hf-fruit relative block cursor-pointer select-none ${f.size} ${on ? "hf-popped" : ""}`}>
                    <span className="hf-art block size-full"><Art kind={f.kind} /></span>
                    {on && (
                      <>
                        {DROPS.map((d, k) => <i key={k} className="hf-drop" style={{ background: f.juice, ["--tx" as string]: `${d.tx}px`, ["--ty" as string]: `${d.ty}px` }} />)}
                        <b className="hf-note display">{NOTES[(taps + i) % NOTES.length]}</b>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
