import type { CSSProperties } from "react";
import { drinkColor, isChoppable, knownIngredients } from "@/lib/ingredients";
import { categoryEmoji } from "@/lib/emoji";
import { BOARD_X, ITEM_Y, MOUTH_X, MOUTH_Y, prepTimeline } from "@/lib/prep-timeline";

/**
 * Анимация «как делается напиток»: по одному ингредиенту кладут на доску, рубят ножом и «бац» в блендер,
 * смесь взбивается, банку поднимают над стаканом, наклоняют и льют, в стакан ставят трубочку.
 * Цвет напитка складывается из цветов ингредиентов (клубника с бананом розовые, шпинат зелёный), нет данных — цвет категории.
 * Это иллюстрация, а не съёмка: на ней настоящие ингредиенты позиции, но не наша кухня.
 * Длина цикла зависит от числа ингредиентов (lib/prep-timeline.ts). При «уменьшить движение» показывается готовый стакан.
 */
export function PrepScene({ ingredients, categorySlug, name }: { ingredients: string[]; categorySlug: string; name: string }) {
  const all = knownIngredients(ingredients, 8);
  // разные ингредиенты с одной эмодзи (шпинат и сельдерей) рисуем одним, иначе на доске два одинаковых листа
  const known = [...new Set(all.map((k) => k.emoji))];
  const produce = known.filter(isChoppable).slice(0, 3);
  // Рубим только то, что рубят (фрукты, овощи, зелень). Лёд и молоко на доске не режут. Нет ни одного такого: кладём в блендер целиком, без ножа.
  const chop = produce.length > 0;
  const items = chop ? produce : known.length ? known.slice(0, 3) : [categoryEmoji(categorySlug)];
  const { css } = prepTimeline({ n: items.length, chop });
  const drink = drinkColor(all) ?? "var(--tone)";
  return (
    <svg viewBox="0 0 360 420" role="img" aria-label={`Как делается «${name}»: ингредиенты режут, кладут в блендер, взбивают и переливают в стакан`} data-chop={chop ? 1 : 0}
      className="prep block h-auto w-full" style={{ "--drink": drink } as CSSProperties}>
      <style>{css}</style>
      <defs>
        <clipPath id="prep-jar"><path d="M222 112h92l-12 196a10 10 0 0 1-10 9h-48a10 10 0 0 1-10-9z" /></clipPath>
        <clipPath id="prep-glass"><path d="M84 246h84l-9 124a8 8 0 0 1-8 7h-50a8 8 0 0 1-8-7z" /></clipPath>
        <clipPath id="prep-l" clipPathUnits="objectBoundingBox"><rect x="0" y="0" width="0.5" height="1" /></clipPath>
        <clipPath id="prep-r" clipPathUnits="objectBoundingBox"><rect x="0.5" y="0" width="0.5" height="1" /></clipPath>
        <radialGradient id="prep-bg" cx="50%" cy="38%" r="70%"><stop offset="0" stopColor="var(--drink)" stopOpacity="0.5" /><stop offset="1" stopColor="var(--drink)" stopOpacity="0" /></radialGradient>
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

      {/* ингредиенты по одному: лежит на доске, режется пополам, запрыгивает в блендер */}
      {items.map((e, i) => (
        <g key={i} className={`prep-pc prep-pc-${i}`} style={{ "--dx": `${MOUTH_X - BOARD_X}px`, "--dy": `${MOUTH_Y - ITEM_Y}px` } as CSSProperties}>
          {chop ? (
            <>
              <text className={`prep-half prep-half-l-${i}`} clipPath="url(#prep-l)" x={BOARD_X} y="318" fontSize="46" textAnchor="middle">{e}</text>
              <text className={`prep-half prep-half-r-${i}`} clipPath="url(#prep-r)" x={BOARD_X} y="318" fontSize="46" textAnchor="middle">{e}</text>
            </>
          ) : (
            <text x={BOARD_X} y="318" fontSize="46" textAnchor="middle">{e}</text>
          )}
        </g>
      ))}

      {/* нож: острие в точке (0, 0) на уровне доски */}
      <g transform="translate(0 330)">
        <g className="prep-knife"><g transform="scale(1.3)">
          <rect x="-5" y="-66" width="10" height="28" rx="4.5" fill="#3b2a20" /><circle cx="0" cy="-60" r="1.8" fill="#d8c3a5" /><circle cx="0" cy="-48" r="1.8" fill="#d8c3a5" />
          <path d="M-17 -38h34l-2 36a3 3 0 0 1-3 2h-24a3 3 0 0 1-3-2z" fill="url(#prep-steel)" />
          <path d="M-14 -34h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
        </g></g>
      </g>

      {/* блендер: основание стоит, банка взбивается, поднимается и наклоняется */}
      <rect x="216" y="320" width="104" height="62" rx="14" fill="#1b2b24" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" />
      <circle cx="268" cy="351" r="9" fill="var(--drink)" /><rect x="240" y="364" width="56" height="5" rx="2.5" fill="#fff" opacity="0.25" />
      <g className="prep-jar">
        <path d="M222 112h92l-12 196a10 10 0 0 1-10 9h-48a10 10 0 0 1-10-9z" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" />
        <g clipPath="url(#prep-jar)">
          <rect className="prep-liq-jar" x="220" y="112" width="100" height="208" fill="var(--drink)" />
          <path className="prep-foam" d="M222 150q12-8 24 0t24 0t24 0t24 0v20h-96z" fill="#fff" opacity="0.35" />
        </g>
        <rect className="prep-lid" x="218" y="100" width="100" height="14" rx="6" fill="#fff" fillOpacity="0.85" />
      </g>

      {/* струя из поднятой банки в стакан */}
      <path className="prep-pour" d="M84 124Q80 190 82 268" fill="none" stroke="var(--drink)" strokeWidth="9" strokeLinecap="round" pathLength="1" />

      {/* стакан слева, под носиком банки */}
      <g className="prep-glass"><g transform="translate(-44 0)">
        <path d="M84 246h84l-9 124a8 8 0 0 1-8 7h-50a8 8 0 0 1-8-7z" fill="#fff" fillOpacity="0.1" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" />
        <g clipPath="url(#prep-glass)"><rect className="prep-liq-glass" x="82" y="246" width="90" height="134" fill="var(--drink)" /></g>
        <path className="prep-straw" d="M142 218l16-44" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      </g></g>

      {/* готово */}
      <g className="prep-done" fill="#fff">
        <path d="M24 196l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" /><path d="M140 214l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M134 300l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </g>
    </svg>
  );
}
