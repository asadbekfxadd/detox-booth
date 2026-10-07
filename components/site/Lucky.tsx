"use client";
import { useRouter } from "next/navigation";

/** «Мне повезёт»: открывает случайную позицию из меню. */
export function Lucky({ slugs, className = "" }: { slugs: string[]; className?: string }) {
  const router = useRouter();
  if (slugs.length === 0) return null;
  return (
    <button type="button" onClick={() => router.push(`/menu/${slugs[Math.floor(Math.random() * slugs.length)]}`)}
      className={`btn btn-pom pop wiggle ${className}`}>
      <span aria-hidden>🎲</span> Мне повезёт
    </button>
  );
}
