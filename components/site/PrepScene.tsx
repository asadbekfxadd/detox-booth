import type { CSSProperties } from "react";
import { isChoppable, knownIngredients } from "@/lib/ingredients";
import { categoryEmoji } from "@/lib/emoji";

/**
 * Анимация «как делается напиток»: ингредиенты лежат на доске, нож рубит их, половинки «бац» запрыгивают в блендер,
 * смесь взбивается, блендер наклоняется и переливает её в стакан, в стакан ставится трубочка.
 * Это иллюстрация, а не съёмка: на ней настоящие ингредиенты позиции, но не наша кухня. Цвет напитка — цвет категории (--tone).
 * Цикл 12 секунд, доли цикла описаны в globals.css. При «уменьшить движение» показывается готовый стакан.
 */
const BOARD_X: Record<number, number[]> = { 1: [104], 2: [74, 134], 3: [56, 104, 152] };
const MOUTH_X = 268;   // середина горловины блендера
const ITEM_Y = 304;    // где у ингредиента на доске середина
const MOUTH_Y = 92;    // высота горловины

export function PrepScene({ ingredients, categorySlug, name }: { ingredients: string[]; categorySlug: string; name: string }) {
  // разные ингредиенты с одной эмодзи (шпинат и сельдерей) рисуем одним, иначе на доске два одинаковых листа
  const known = [...new Set(knownIngredients(ingredients, 8).map((k) => k.emoji))];
  const produce = known.filter(isChoppable).slice(0, 3);
  // Рубим только то, что рубят (фрукты, овощи, зелень). Лёд и молоко на доске не режут. Нет ни одного такого: кладём в блендер целиком, без ножа.
  const chop = produce.length > 0;
  const items = chop ? produce : known.length ? known.slice(0, 3) : [categoryEmoji(categorySlug)];
  const xs = BOARD_X[items.length];
  const hit = (k: number) => `${xs[Math.min(k, xs.length - 1)]}px`;
  return (
    <svg viewBox="0 0 360 420" role="img" aria-label={`Как делается «${name}»: ингредиенты режут, кладут в блендер, взбивают и переливают в стакан`} data-chop={chop ? 1 : 0}
      className="prep block h-auto w-full" style={{ "--k0": hit(0), "--k1": hit(1), "--k2": hit(2) } as CSSProperties}>
      <defs>
        <clipPath id="prep-jar"><path d="M222 112h92l-12 196a10 10 0 0 1-10 9h-48a10 10 0 0 1-10-9z" /></clipPath>
        <clipPath id="prep-glass"><path d="M84 246h84l-9 124a8 8 0 0 1-8 7h-50a8 8 0 0 1-8-7z" /></clipPath>
        <clipPath id="prep-l" clipPathUnits="objectBoundingBox"><rect x="0" y="0" width="0.5" height="1" /></clipPath>
        <clipPath id="prep-r" clipPathUnits="objectBoundingBox"><rect x="0.5" y="0" width="0.5" height="1" /></clipPath>
        <radialGradient id="prep-bg" cx="50%" cy="38%" r="70%"><stop offset="0" stopColor="var(--tone)" stopOpacity="0.55" /><stop offset="1" stopColor="var(--tone)" stopOpacity="0" /></radialGradient>
        <linearGradient id="prep-steel" x1="0" x2="1"><stop offset="0" stopColor="#f4f8f9" /><stop offset="1" stopColor="#aab7bc" /></linearGradient>
      </defs>
      <rect width="360" height="420" fill="url(#prep-bg)" />
      <ellipse cx="180" cy="398" rx="160" ry="10" fill="#000" opacity="0.25" />

      {/* доска */}
      <g className="prep-board">
        <rect x="24" y="334" width="160" height="22" rx="9" fill="#a8703a" />
        <rect x="24" y="328" width="160" height="16" rx="8" fill="#d09a58" />
        <rect x="40" y="332" width="128" height="3" rx="1.5" fill="#fff" opacity="0.28" />
        <circle cx="168" cy="345" r="4" fill="#7c4f24" />
      </g>

      {/* ингредиенты: лежат на доске, режутся пополам, запрыгивают в блендер */}
      {items.map((e, i) => (
        <g key={i} className="prep-pc" style={{ "--i": i, "--dx": `${MOUTH_X - xs[i]}px`, "--dy": `${MOUTH_Y - ITEM_Y}px` } as CSSProperties}>
          {chop ? (
            <>
              <text className="prep-half prep-half-l" clipPath="url(#prep-l)" x={xs[i]} y="318" fontSize="42" textAnchor="middle">{e}</text>
              <text className="prep-half prep-half-r" clipPath="url(#prep-r)" x={xs[i]} y="318" fontSize="42" textAnchor="middle">{e}</text>
            </>
          ) : (
            <text x={xs[i]} y="318" fontSize="46" textAnchor="middle">{e}</text>
          )}
        </g>
      ))}

      {/* нож: острие в точке (0, 0) на уровне доски, рубит три раза */}
      <g transform="translate(0 330)">
        <g className="prep-knife"><g transform="scale(1.3)">
          <rect x="-5" y="-66" width="10" height="28" rx="4.5" fill="#3b2a20" /><circle cx="0" cy="-60" r="1.8" fill="#d8c3a5" /><circle cx="0" cy="-48" r="1.8" fill="#d8c3a5" />
          <path d="M-17 -38h34l-2 36a3 3 0 0 1-3 2h-24a3 3 0 0 1-3-2z" fill="url(#prep-steel)" />
          <path d="M-14 -34h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
        </g></g>
      </g>

      {/* блендер: основание стоит, банка взбивается и наклоняется */}
      <rect x="216" y="320" width="104" height="62" rx="14" fill="#1b2b24" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" />
      <circle cx="268" cy="351" r="9" fill="var(--tone)" /><rect x="240" y="364" width="56" height="5" rx="2.5" fill="#fff" opacity="0.25" />
      <g className="prep-jar">
        <path d="M222 112h92l-12 196a10 10 0 0 1-10 9h-48a10 10 0 0 1-10-9z" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" />
        <g clipPath="url(#prep-jar)">
          <rect className="prep-liq-jar" x="220" y="112" width="100" height="208" fill="var(--tone)" />
          <path className="prep-foam" d="M222 150q12-8 24 0t24 0t24 0t24 0v20h-96z" fill="#fff" opacity="0.35" />
        </g>
        <rect className="prep-lid" x="218" y="100" width="100" height="14" rx="6" fill="#fff" fillOpacity="0.85" />
      </g>

      {/* струя из банки в стакан */}
      <path className="prep-pour" d="M130 150Q124 205 126 266" fill="none" stroke="var(--tone)" strokeWidth="9" strokeLinecap="round" pathLength="1" />

      {/* стакан */}
      <g className="prep-glass">
        <path d="M84 246h84l-9 124a8 8 0 0 1-8 7h-50a8 8 0 0 1-8-7z" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" />
        <g clipPath="url(#prep-glass)"><rect className="prep-liq-glass" x="82" y="246" width="90" height="134" fill="var(--tone)" /></g>
        <path className="prep-straw" d="M142 218l16-44" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* готово */}
      <g className="prep-done" fill="#fff">
        <path d="M60 196l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" /><path d="M186 214l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M176 300l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </g>
    </svg>
  );
}
