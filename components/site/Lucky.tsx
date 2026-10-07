"use client";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

/** «Мне повезёт»: открывает случайную позицию из меню. */
export function Lucky({ slugs, className = "" }: { slugs: string[]; className?: string }) {
  const router = useRouter();
  if (slugs.length === 0) return null;
  return (
    <button type="button" onClick={() => router.push(`/menu/${slugs[Math.floor(Math.random() * slugs.length)]}`)}
      className={`btn btn-accent wiggle ${className}`}>
      <Icon name="dice" size={18} /> Мне повезёт
    </button>
  );
}
