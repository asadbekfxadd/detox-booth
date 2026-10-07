import type { CSSProperties } from "react";

export type MandarinState = "idle" | "run" | "talk" | "point";

/**
 * Мандаринка: оригинальный персонаж Vitamin B. Круглый оранжевый фрукт с листиком, зелёными кроссовками и румянцем.
 * Позой управляет атрибут data-state, анимации лежат в globals.css (.mdr-*), направление — переменная --face (1 или -1).
 */
export function MandarinCharacter({ state = "idle", face = 1, className = "" }: { state?: MandarinState; face?: 1 | -1; className?: string }) {
  return (
    <svg viewBox="0 0 120 150" className={`mdr ${className}`} data-state={state} style={{ "--face": face } as CSSProperties} aria-hidden focusable="false">
      <defs>
        <radialGradient id="mdr-skin" cx="38%" cy="30%" r="78%">
          <stop offset="0" stopColor="#ffd860" /><stop offset="0.45" stopColor="#ff9d1c" /><stop offset="1" stopColor="#e45a00" />
        </radialGradient>
        <linearGradient id="mdr-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#62c840" /><stop offset="1" stopColor="#1f7a1f" />
        </linearGradient>
      </defs>
      <ellipse className="mdr-shadow" cx="60" cy="145" rx="30" ry="5" fill="#072d17" opacity="0.16" />
      <g className="mdr-flip">
        <g className="mdr-body-wrap">
          {/* ноги и кроссовки */}
          <g className="mdr-leg mdr-leg-l">
            <path d="M47 108V126" stroke="#0d4a27" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx="46" cy="131.5" rx="11.5" ry="6.4" fill="#fff" stroke="#0d4a27" strokeWidth="2.6" />
            <path d="M36.5 134h19" stroke="#ff8a00" strokeWidth="2.4" strokeLinecap="round" />
          </g>
          <g className="mdr-leg mdr-leg-r">
            <path d="M73 108V126" stroke="#0d4a27" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx="74" cy="131.5" rx="11.5" ry="6.4" fill="#fff" stroke="#0d4a27" strokeWidth="2.6" />
            <path d="M64.5 134h19" stroke="#ff8a00" strokeWidth="2.4" strokeLinecap="round" />
          </g>
          {/* руки */}
          <g className="mdr-arm mdr-arm-l">
            <path d="M24 78C11 82 7 94 12 101" stroke="#e45a00" strokeWidth="8" fill="none" strokeLinecap="round" />
            <circle cx="12" cy="101" r="5.6" fill="#ffb000" />
          </g>
          <g className="mdr-arm mdr-arm-r">
            <path d="M96 78C109 82 113 94 108 101" stroke="#e45a00" strokeWidth="8" fill="none" strokeLinecap="round" />
            <circle cx="108" cy="101" r="5.6" fill="#ffb000" />
          </g>
          {/* тело */}
          <ellipse cx="60" cy="76" rx="45" ry="40" fill="url(#mdr-skin)" />
          <ellipse cx="38" cy="52" rx="11" ry="6" fill="#fff" opacity="0.35" transform="rotate(-30 38 52)" />
          <ellipse cx="60" cy="38.5" rx="6" ry="2.4" fill="#b93f00" opacity="0.55" />
          {/* стебелёк и листья */}
          <g className="mdr-leaf-wrap">
            <rect x="57.5" y="28" width="5" height="9" rx="2.5" fill="#6b3f1d" />
            <path d="M62 33C72 19 91 21 95 30C85 39 70 39 62 33Z" fill="url(#mdr-leaf)" />
            <path d="M64 33C73 28 83 27 91 30" stroke="#1f7a1f" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <path d="M58 34C50 24 38 26 36 32C44 38 52 38 58 34Z" fill="#1f7a1f" />
          </g>
          {/* лицо */}
          <ellipse cx="34" cy="84" rx="7" ry="4.5" fill="#ff4b2b" opacity="0.4" />
          <ellipse cx="86" cy="84" rx="7" ry="4.5" fill="#ff4b2b" opacity="0.4" />
          <g className="mdr-eyes">
            <ellipse cx="47" cy="71" rx="5.4" ry="7" fill="#0b2a16" /><circle cx="45.2" cy="68" r="2" fill="#fff" />
            <ellipse cx="73" cy="71" rx="5.4" ry="7" fill="#0b2a16" /><circle cx="71.2" cy="68" r="2" fill="#fff" />
          </g>
          <path className="mdr-smile" d="M51 86Q60 95 69 86" stroke="#0b2a16" strokeWidth="3" fill="none" strokeLinecap="round" />
          <g className="mdr-mouth-open">
            <path d="M50 85Q60 103 70 85Z" fill="#7a1d12" />
            <ellipse cx="60" cy="93.5" rx="5" ry="3" fill="#ff7a6a" />
          </g>
          {/* искорки, когда показывает товар */}
          <g className="mdr-spark" fill="#fff">
            <path d="M106 36l2.2 5.6 5.6 2.2-5.6 2.2L106 51.6l-2.2-5.6-5.6-2.2 5.6-2.2z" />
            <path d="M14 46l1.4 3.6 3.6 1.4-3.6 1.4L14 56l-1.4-3.6L9 51l3.6-1.4z" />
          </g>
        </g>
      </g>
    </svg>
  );
}
