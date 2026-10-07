"use client";
import { useEffect, useRef, useState } from "react";
import { categoryEmoji } from "@/lib/emoji";
import { toneClass } from "@/lib/tone";

type Props = {
  image: string | null; name: string; categorySlug: string;
  /** arch — арка (карточки, главная); wide — прямоугольник; thumb — маленькая плитка */
  shape?: "arch" | "wide" | "thumb"; className?: string; priority?: boolean;
};

/** Фото продукта в цвете его категории. Нет фото или оно не загрузилось — показываем эмодзи на цветной плашке. */
export function ProductImage({ image, name, categorySlug, shape = "arch", className = "", priority = false }: Props) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Картинка могла не загрузиться ещё до гидратации: событие onError тогда уже прошло.
  useEffect(() => { const el = ref.current; if (el && el.complete && el.naturalWidth === 0) setBroken(true); }, [image]);
  const form = shape === "arch" ? "arch aspect-[4/5]" : shape === "thumb" ? "rounded-2xl aspect-square" : "rounded-3xl aspect-[16/10]";
  const size = shape === "thumb" ? "text-3xl" : "text-7xl";
  return (
    <div className={`${toneClass(categorySlug)} relative w-full overflow-hidden bg-(--tone) ${form} ${className}`}>
      {image && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img ref={ref} src={image} alt={name} loading={priority ? "eager" : "lazy"} decoding="async" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
        : <div className={`absolute inset-0 grid place-items-center ${size}`} role="img" aria-label={name}><span aria-hidden>{categoryEmoji(categorySlug)}</span></div>}
    </div>
  );
}
