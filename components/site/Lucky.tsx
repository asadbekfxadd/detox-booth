"use client";
import { useRouter } from "next/navigation";

/** «Мне повезёт»: открывает случайную позицию из меню. */
export function Lucky({ slugs, className = "" }: { slugs: string[]; className?: string }) {
  const router = useRouter();
  if (slugs.length === 0) return null;
  return (
    <button type="button" onClick={() => router.push(`/menu/${slugs[Math.floor(Math.random() * slugs.length)]}`)}
      className={`btn btn-pom wiggle ${className}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg> Мне повезёт
    </button>
  );
}
