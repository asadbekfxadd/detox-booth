"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { nearestIndex, photoWeight, smooth, textOpacity, trackProgress } from "@/lib/scroll-scene";

export type CinemaPhoto = { src: string; srcSet?: string; alt: string };

const CHAPTERS = [
  { id: "cinema-1", text: "", cta: "Смотреть меню", href: "/menu" },
  { id: "cinema-2", title: "СВЕЖЕСТЬ", text: "Только натуральные фрукты, ягоды и зелень. Без консервантов, с настоящим вкусом.", cta: "Смотреть меню", href: "/menu" },
  { id: "cinema-3", title: "НАСТРОЕНИЕ", text: "Бодрость с утра, лёгкость после тренировки, сытный обед или просто повод порадовать себя.", cta: "Выбрать по настроению", href: "#cinema-next" },
] as const;

function Arrow({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden className={`cta-arrow ${className}`}><path d="M4 12h16m-6-6 6 6-6 6" /></svg>;
}

/**
 * Первый экран «Кино»: тёмная сцена закреплена (sticky) в длинной секции, фото напитков листаются прокруткой,
 * подписи идут в обычном потоке страницы и плавно проявляются. На компьютере в конце сцена уменьшается, наклоняется и уходит вверх,
 * открывая следующий блок (id="cinema-next"). На телефоне блок просто идёт после последнего фото.
 * Движение считается один раз за кадр анимации и только при прокрутке. «Уменьшить движение»: статичное первое фото и все подписи.
 */
export function CinemaScene({ name, text, photos, place }: { name: string; text: string; photos: CinemaPhoto[]; place: string | null }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const rule = useRef<HTMLSpanElement>(null);
  const steps = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const el = root.current, st = stage.current, sc = scene.current, ly = layer.current;
    if (!el || !st || !sc || !ly || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const finaleMq = window.matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");
    const imgs = [...ly.querySelectorAll<HTMLElement>("[data-photo]")];
    const boxes = steps.current.filter((s): s is HTMLElement => !!s);
    const memo = { photo: imgs.map(() => -1), text: boxes.map(() => -1), finale: -1, chapter: -1, scale: -1 };
    let raf = 0;

    const tick = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const S = st.offsetHeight;
      const t = trackProgress(-rect.top, rect.height, S, finaleMq.matches ? S : 0);

      imgs.forEach((im, i) => {
        const w = photoWeight(t.progress, i, imgs.length);
        if (Math.abs(w - memo.photo[i]) < 0.004) return;
        memo.photo[i] = w; im.style.opacity = w.toFixed(3);
      });
      const scale = 1.04 + 0.12 * t.progress;
      if (Math.abs(scale - memo.scale) > 0.0005) { memo.scale = scale; ly.style.transform = `scale(${scale.toFixed(4)})`; }

      const tops = boxes.map((b) => b.getBoundingClientRect().top);
      boxes.forEach((b, i) => {
        const o = textOpacity(tops[i] / S);
        if (Math.abs(o - memo.text[i]) < 0.004) return;
        memo.text[i] = o;
        const inner = b.firstElementChild as HTMLElement;
        inner.style.opacity = o.toFixed(3);
        inner.style.filter = o < 0.999 ? `blur(${((1 - o) * 5).toFixed(2)}px)` : "none";
        b.toggleAttribute("inert", o < 0.35);
      });
      const ch = nearestIndex(tops);
      if (ch !== memo.chapter) { memo.chapter = ch; if (number.current) number.current.textContent = String(ch + 1).padStart(2, "0"); }
      if (rule.current) rule.current.style.width = `${(t.progress * 100).toFixed(2)}%`;
      if (Math.abs(t.finale - memo.finale) > 0.001 || (t.finale === 0) !== (memo.finale === 0)) {
        memo.finale = t.finale; sc.style.setProperty("--f", t.finale.toFixed(4));
        if (footer.current) footer.current.style.opacity = String(1 - smooth(0, 0.35, t.finale));
      }
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    finaleMq.addEventListener("change", request);
    request();
    return () => { window.removeEventListener("scroll", request); window.removeEventListener("resize", request); finaleMq.removeEventListener("change", request); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const lead = text || "Свежие соки, фруктовые миксы и смузи для взрослых и детей. Готовим сразу после заказа.";
  return (
    <section ref={root} className="cinema-hero" aria-label={name}>
      <div ref={stage} className="cinema-stage">
        <div ref={scene} className="cinema-scene">
          <div ref={layer} className="cinema-photos">
            {photos.length === 0 && <div className="cinema-fallback" aria-hidden />}
            {photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.src} data-photo src={p.src} srcSet={p.srcSet} sizes="100vw" alt="" aria-hidden decoding="async" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} className="cinema-photo" style={{ opacity: i === 0 ? 1 : 0 }} />
            ))}
          </div>
          <div className="cinema-shade" aria-hidden />
        </div>
        <div ref={footer} className="cinema-footer">
          <span className="cinema-place">{place ?? ""}</span>
          <a className="cinema-cue" href="#cinema-2" aria-label="Листайте, чтобы открыть"><span>Листайте, чтобы открыть</span><span className="cinema-stem" aria-hidden /></a>
          <div className="cinema-chapters" aria-hidden><span ref={number}>01</span><span className="cinema-rule"><span ref={rule} /></span><span className="cinema-total">03</span></div>
        </div>
      </div>

      <div className="cinema-story">
        {CHAPTERS.map((c, i) => (
          <article key={c.id} id={c.id} ref={(n) => { steps.current[i] = n; }} className={`cinema-step${i === CHAPTERS.length - 1 ? " cinema-step--last" : ""}`}>
            <div className="cinema-box">
              {i === 0 ? <h1>{name}</h1> : <h2>{"title" in c ? c.title : ""}</h2>}
              <p>{i === 0 ? lead : c.text}</p>
              <Link href={c.href} className="cta-line"><span>{c.cta}</span><Arrow /></Link>
            </div>
          </article>
        ))}
        <div className="cinema-tail" aria-hidden />
      </div>
    </section>
  );
}
