/** Нарисованные фрукты в одном стиле: плоская заливка и контур цвета чернил. Используются как декор. */
const O = "#18281c";
type P = { className?: string };

export function OrangeSlice({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="32" cy="32" r="28" fill="#ff9a1f" stroke={O} strokeWidth="3" />
      <circle cx="32" cy="32" r="21" fill="#ffd36b" stroke={O} strokeWidth="2" />
      {[0, 60, 120].map((a) => <line key={a} x1="32" y1="11" x2="32" y2="53" stroke={O} strokeWidth="2" transform={`rotate(${a} 32 32)`} />)}
    </svg>
  );
}
export function Strawberry({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M32 58C13 45 7 31 13 21c5-8 14-6 19-1 5-5 14-7 19 1 6 10 0 24-19 37z" fill="#ff4d5e" stroke={O} strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 17l6 5 6-7 6 7 6-5-4 8H24z" fill="#4cc46a" stroke={O} strokeWidth="2.2" strokeLinejoin="round" />
      {[[24, 34], [34, 30], [40, 40], [30, 44], [22, 44]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1.6" ry="2.4" fill="#ffe8a0" />)}
    </svg>
  );
}
export function Lemon({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <g transform="rotate(-28 32 32)">
        <ellipse cx="32" cy="32" rx="26" ry="18" fill="#ffe45c" stroke={O} strokeWidth="3" />
        <circle cx="5" cy="32" r="3.5" fill="#ffe45c" stroke={O} strokeWidth="2.4" />
        <circle cx="59" cy="32" r="3.5" fill="#ffe45c" stroke={O} strokeWidth="2.4" />
        <path d="M18 26c4-5 10-7 16-6" stroke="#fff6b0" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
export function Leaf({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M8 56C8 27 27 7 57 7c0 29-17 49-49 49z" fill="#4cc46a" stroke={O} strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 52C26 38 38 26 50 14" stroke={O} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
export function Berries({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {[[22, 40, 15], [43, 38, 14], [32, 20, 14]].map(([x, y, r]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r={r} fill="#5a5bd6" stroke={O} strokeWidth="3" />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.22} fill="#c9caff" />
          <circle cx={x} cy={y + r * 0.1} r="2" fill={O} opacity=".5" />
        </g>
      ))}
    </svg>
  );
}
export function Sparkle({ className }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M32 3c3 17 12 26 29 29-17 3-26 12-29 29-3-17-12-26-29-29C20 29 29 20 32 3z" fill="#d4f26a" stroke={O} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

const ALL = { orange: OrangeSlice, strawberry: Strawberry, lemon: Lemon, leaf: Leaf, berries: Berries, sparkle: Sparkle } as const;
export type ArtName = keyof typeof ALL;
export function Art({ name, className }: { name: ArtName; className?: string }) {
  const C = ALL[name];
  return <C className={className} />;
}
