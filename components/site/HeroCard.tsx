"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sum } from "@/lib/format";
import { toneClass } from "@/lib/tone";
import { ProductImage } from "./ProductImage";

export type HeroSlide = { id: string; slug: string; name: string; image: string | null; categorySlug: string; price: number };

/**
 * Карточка первого экрана: сама листает несколько настоящих позиций меню. Фото плавно сменяются и чуть приближаются,
 * название и цена меняются вместе с фото, клик ведёт на текущую позицию.
 * Три карточки идут с разным шагом и сдвигом, чтобы не сменяться одновременно.
 * Пауза: курсор или фокус на карточке, вкладка в фоне, карточка вне экрана. При «уменьшении движения» показывается первое фото.
 */
export function HeroCard({ slides, index, tall = false, className = "" }: { slides: HeroSlide[]; index: number; tall?: boolean; className?: string }) {
  const [cur, setCur] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const hold = useRef(false);

  useEffect(() => {
    const el = root.current;
    if (!el || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = true, iv = 0;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const tick = () => { if (!hold.current && visible && !document.hidden) setCur((c) => (c + 1) % slides.length); };
    const first = window.setTimeout(() => { tick(); iv = window.setInterval(tick, 5200 + index * 700); }, 2600 + index * 1500);
    return () => { window.clearTimeout(first); window.clearInterval(iv); io.disconnect(); };
  }, [slides.length, index]);

  return (
    <div ref={root} className={`arch-rise relative ${tall ? "row-span-2 self-start" : ""} ${className}`}
      onPointerEnter={() => { hold.current = true; }} onPointerLeave={() => { hold.current = false; }}
      onFocus={() => { hold.current = true; }} onBlur={() => { hold.current = false; }}>
      <div className={`relative overflow-hidden rounded-[1.75rem] border-4 border-white bg-white shadow-[0_24px_50px_-24px_rgba(7,45,23,0.55)] ${tall ? "aspect-[3/4]" : "aspect-square"}`}>
        {slides.map((s, k) => (
          <Link key={s.id} href={`/menu/${s.slug}`} data-on={k === cur} aria-hidden={k !== cur} tabIndex={k === cur ? 0 : -1}
            className={`${toneClass(s.categorySlug)} hs-slide absolute inset-0 block`}>
            <ProductImage image={s.image} name={s.name} categorySlug={s.categorySlug} priority={k === 0} className="h-full! aspect-auto! rounded-none!" />
            <span className="display absolute bottom-3 left-3 right-3 truncate rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold leading-tight text-forest shadow sm:text-xs">
              {s.name} <span className="text-orange-deep">{sum(s.price)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
