"use client";
import { useEffect, useRef, useState } from "react";
import { categoryEmoji } from "@/lib/emoji";
import { toneClass } from "@/lib/tone";
import { imageSet, SIZES } from "@/lib/image-src";

type Props = {
  image: string | null; name: string; categorySlug: string;
  /** arch — вертикальное фото (карточки, главная); wide — широкое; thumb — маленькая плитка */
  shape?: "arch" | "wide" | "thumb"; className?: string; priority?: boolean;
  /** подсказка браузеру, какой ширины будет картинка; по умолчанию по форме */
  sizes?: string;
};

/** Фото продукта на подложке цвета его категории. Нет фото или оно не загрузилось — эмодзи на цветной плашке. */
export function ProductImage({ image, name, categorySlug, shape = "arch", className = "", priority = false, sizes }: Props) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Картинка могла не загрузиться ещё до гидратации: событие onError тогда уже прошло.
  useEffect(() => { const el = ref.current; if (el && el.complete && el.naturalWidth === 0) setBroken(true); }, [image]);
  const form = shape === "arch" ? "rounded-2xl aspect-[4/5]" : shape === "thumb" ? "rounded-xl aspect-square" : "rounded-3xl aspect-[16/10]";
  const set = image ? imageSet(image) : null;
  const size = shape === "thumb" ? "text-3xl" : "text-7xl";
  return (
    <div className={`${toneClass(categorySlug)} relative w-full overflow-hidden bg-(--tone) ${form} ${className}`}>
      {image && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img ref={ref} src={set?.src} srcSet={set?.srcSet} sizes={set?.srcSet ? (sizes ?? SIZES[shape]) : undefined} alt={name} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
        : <div className={`absolute inset-0 grid place-items-center text-forest-deep ${size}`} role="img" aria-label={name}><span aria-hidden>{categoryEmoji(categorySlug)}</span></div>}
    </div>
  );
}
