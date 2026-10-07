/** Круглая печать с текстом по кругу и медленным вращением. */
export function SpinBadge({ text = "свежее каждый день ✺ без сахара ✺ ", className = "" }: { text?: string; className?: string }) {
  return (
    <div className={`relative grid place-items-center ${className}`} aria-hidden>
      <svg viewBox="0 0 200 200" className="spin-slow absolute inset-0 h-full w-full">
        <defs><path id="spin-circle" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" /></defs>
        <text className="display" fontSize="19" fontWeight="800" fill="currentColor" letterSpacing="1.5"><textPath href="#spin-circle">{text}</textPath></text>
      </svg>
      <span className="text-5xl sm:text-6xl">🍋</span>
    </div>
  );
}
