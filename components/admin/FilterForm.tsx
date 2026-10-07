"use client";
import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Форма фильтров: собирает значения и явно переходит на ?query. Применяется сразу при выборе. */
export function FilterForm({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const current = useSearchParams();
  const ref = useRef<HTMLFormElement>(null);

  function apply() {
    const form = ref.current;
    if (!form) return;
    const p = new URLSearchParams();
    const view = current.get("view");
    if (view) p.set("view", view);
    new FormData(form).forEach((v, k) => {
      if (typeof v === "string" && v.trim() !== "") p.set(k, v.trim());
    });
    const s = p.toString();
    router.push(s ? `${path}?${s}` : path);
  }

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => { e.preventDefault(); apply(); }}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.tagName !== "INPUT" || t.type === "date") apply();
      }}
    >
      {children}
    </form>
  );
}
