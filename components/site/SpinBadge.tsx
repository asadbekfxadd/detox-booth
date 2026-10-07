/** Круглая печать с текстом по кругу и медленным вращением. */
export function SpinBadge({ text = "свежее каждый день ✺ без сахара ✺ ", className = "" }: { text?: string; className?: string }) {
  return (
    <div className={`relative grid place-items-center ${className}`} aria-hidden>
      <svg viewBox="0 0 200 200" className="spin-slow absolute inset-0 h-full w-full">
        <defs><path id="spin-circle" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" /></defs>
        <text className="display" fontSize="19" fontWeight="800" fill="currentColor" letterSpacing="1.5"><textPath href="#spin-circle">{text}</textPath></text>
      </svg>
      <svg viewBox="0 0 32 32" className="h-1/3 w-1/3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 27C5 13 13 5 27 5c0 14-8 22-22 22z" /><path d="M7 25C13 18 18 13 24 8" />
      </svg>
    </div>
  );
}
