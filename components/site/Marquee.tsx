/** Бегущая строка. Дублируем набор, чтобы цикл был бесшовным. */
export function Marquee({ items, className = "" }: { items: string[]; className?: string }) {
  const row = (key: string) => (
    <ul key={key} className="flex shrink-0 items-center" aria-hidden={key === "b"}>
      {items.map((t) => (
        <li key={t} className="flex items-center">
          <span className="display px-5 text-xl font-extrabold sm:text-2xl">{t}</span>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden className="shrink-0"><path d="M12 1l2.6 7.4L22 12l-7.4 3.6L12 23l-2.6-7.4L2 12l7.4-3.6z" fill="currentColor" /></svg>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`marquee overflow-hidden py-3 ${className}`} role="marquee" aria-label={items.join(", ")}>
      <div className="marquee-track">{row("a")}{row("b")}</div>
    </div>
  );
}
