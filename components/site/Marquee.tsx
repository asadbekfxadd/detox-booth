/** Бегущая строка. Дублируем набор, чтобы цикл был бесшовным. */
export function Marquee({ items, className = "", textClass = "text-[13px] font-extrabold tracking-[0.14em]" }: { items: string[]; className?: string; textClass?: string }) {
  const row = (key: string) => (
    <ul key={key} className="flex shrink-0 items-center" aria-hidden={key === "b"}>
      {items.map((t) => (
        <li key={t} className="flex items-center">
          <span className={`px-5 uppercase ${textClass}`}>{t}</span>
          <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden className="shrink-0 text-orange" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 27C5 13 13 5 27 5c0 14-8 22-22 22z" /></svg>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`marquee overflow-hidden ${className}`} role="marquee" aria-label={items.join(", ")}>
      <div className="marquee-track">{row("a")}{row("b")}</div>
    </div>
  );
}
