/** Линейные иконки в стиле плакатов бренда: тонкий контур, скруглённые концы. */
const PATHS = {
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  pulse: <><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" /><path d="M6 12h3l1.5-3 2 6 1.5-3H18" /></>,
  leaf: <><path d="M5 20C5 10 11 4 20 4c0 9-6 15-15 16z" /><path d="M5 20c3-5 7-9 11-12" /></>,
  run: <><circle cx="14.5" cy="4.5" r="1.8" /><path d="M7 21l3-6 3 2 2-5M10 15l-1-5 5-1 2 3 3 1M9 10l-3 2" /></>,
  apple: <><path d="M12 7c-2-2-6-1-6 4 0 5 3 9 6 9s6-4 6-9c0-5-4-6-6-4z" /><path d="M12 7c0-2 1-3 3-4" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16.5 14.2c2.6.3 4.5 2.4 4.5 5.1" /></>,
  heart: <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5L15.5 10" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  arrow: <path d="M7 17L17 7M8 7h9v9" />,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></>,
  dice: <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></>,
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, className = "", strokeWidth = 1.7 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>{PATHS[name]}</svg>
  );
}

/** Иконка в кружке: как значки преимуществ на плакатах. */
export function IconBadge({ name, className = "" }: { name: IconName; className?: string }) {
  return <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 ${className}`}><Icon name={name} size={22} /></span>;
}
