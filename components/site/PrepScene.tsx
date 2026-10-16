import type { CSSProperties } from "react";
import { knownIngredients } from "@/lib/ingredients";
import { categoryEmoji } from "@/lib/emoji";

/**
 * Анимация «как собирается напиток»: ингредиенты из состава падают в блендер, смесь взбивается, переливается в стакан.
 * Это иллюстрация, а не съёмка: на ней настоящие ингредиенты позиции, но не наша кухня. Цвет напитка — цвет категории (--tone).
 * Цикл 8 секунд. При «уменьшить движение» показывается готовый кадр.
 */
export function PrepScene({ ingredients, categorySlug, name }: { ingredients: string[]; categorySlug: string; name: string }) {
  // разные ингредиенты с одной эмодзи (шпинат и сельдерей) рисуем одним, иначе в блендере два одинаковых листа
  const items = [...new Set(knownIngredients(ingredients, 6).map((k) => k.emoji))].slice(0, 4);
  const fruits = items.length ? items : [categoryEmoji(categorySlug)];
  const xs = [118, 138, 100, 124];
  return (
    <svg viewBox="0 0 360 420" role="img" aria-label={`Как собирается «${name}»: ингредиенты попадают в блендер, смесь взбивается и переливается в стакан`} className="prep block h-auto w-full" style={{ "--n": fruits.length } as CSSProperties}>
      <defs>
        <clipPath id="prep-jar"><path d="M82 112h92l-12 196a10 10 0 0 1-10 9H104a10 10 0 0 1-10-9z" /></clipPath>
        <clipPath id="prep-glass"><path d="M246 246h84l-9 124a8 8 0 0 1-8 7h-50a8 8 0 0 1-8-7z" /></clipPath>
        <radialGradient id="prep-bg" cx="50%" cy="38%" r="70%"><stop offset="0" stopColor="var(--tone)" stopOpacity="0.55" /><stop offset="1" stopColor="var(--tone)" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="360" height="420" fill="url(#prep-bg)" />
      <ellipse cx="190" cy="398" rx="150" ry="10" fill="#000" opacity="0.25" />

      {/* блендер */}
      <g className="prep-jar">
        <rect x="76" y="320" width="104" height="62" rx="14" fill="#1b2b24" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" />
        <circle cx="128" cy="351" r="9" fill="var(--tone)" /><rect x="100" y="364" width="56" height="5" rx="2.5" fill="#fff" opacity="0.25" />
        <path d="M82 112h92l-12 196a10 10 0 0 1-10 9H104a10 10 0 0 1-10-9z" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" />
        <g clipPath="url(#prep-jar)">
          <rect className="prep-liq-jar" x="80" y="112" width="100" height="208" fill="var(--tone)" />
          <path className="prep-foam" d="M82 150q12-8 24 0t24 0t24 0t24 0v20H82z" fill="#fff" opacity="0.35" />
        </g>
        <rect className="prep-lid" x="78" y="100" width="100" height="14" rx="6" fill="#fff" fillOpacity="0.85" />
      </g>

      {/* ингредиенты падают в банку */}
      {fruits.map((e, i) => (
        <text key={i} className="prep-fruit" x={xs[i % xs.length]} y="40" fontSize="46" textAnchor="middle" style={{ "--i": i } as CSSProperties}>{e}</text>
      ))}

      {/* струя из банки в стакан */}
      <path className="prep-pour" d="M172 124Q250 118 288 240" fill="none" stroke="var(--tone)" strokeWidth="9" strokeLinecap="round" pathLength="1" />

      {/* стакан */}
      <path d="M246 246h84l-9 124a8 8 0 0 1-8 7h-50a8 8 0 0 1-8-7z" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" />
      <g clipPath="url(#prep-glass)"><rect className="prep-liq-glass" x="244" y="246" width="90" height="134" fill="var(--tone)" /></g>
      <path className="prep-straw" d="M300 214l14-40" stroke="#fff" strokeWidth="6" strokeLinecap="round" />

      {/* готово */}
      <g className="prep-done" fill="#fff">
        <path d="M338 196l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" /><path d="M222 206l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M350 292l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </g>
    </svg>
  );
}
