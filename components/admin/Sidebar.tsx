"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { label: string; href: string; group: string; match?: string[] };

const isActive = (path: string, i: Item) => path === i.href || path.startsWith(i.href + "/") || !!i.match?.some((m) => path === m || path.startsWith(m + "/"));

/**
 * Широкий экран — боковое меню. Телефон — верхняя полоса с кнопкой «Меню»: список из двух десятков пунктов
 * не помещается в одну прокручиваемую строку, поэтому открывается панель с группами и крупными пунктами.
 */
export function Sidebar({ items, brandName }: { items: Item[]; brandName: string }) {
  const path = usePathname();
  const groups = [...new Set(items.map((i) => i.group))];
  const [open, setOpen] = useState(false);
  const current = items.find((i) => isActive(path, i));

  // после перехода по пункту панель закрывается
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-200 bg-white px-3 py-2 md:hidden print:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="admin-drawer" data-admin-menu
          className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 px-4 font-semibold">
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          Меню
        </button>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-green-900">{current?.label ?? brandName}</span>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Разделы админки" id="admin-drawer">
          <button type="button" aria-label="Закрыть меню" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col gap-4 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-lg font-extrabold tracking-wide text-green-800">{brandName}</p>
                <p className="text-xs text-neutral-500">Панель управления</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-xl border border-neutral-200 text-xl" aria-label="Закрыть меню">×</button>
            </div>
            {groups.map((g) => (
              <div key={g}>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{g}</p>
                {items.filter((i) => i.group === g).map((i) => (
                  <Link key={i.href} href={i.href} className={`flex min-h-11 items-center rounded-lg px-3 text-base ${isActive(path, i) ? "bg-lime-100 font-semibold text-green-900" : "text-neutral-700 active:bg-neutral-100"}`}>{i.label}</Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
      )}

      <aside className="hidden md:flex print:!hidden w-60 shrink-0 flex-col gap-5 border-r border-neutral-200 bg-white p-4">
        <div className="px-2">
          <p className="text-lg font-extrabold tracking-wide text-green-800">{brandName}</p>
          <p className="text-xs text-neutral-500">Панель управления</p>
        </div>
        {groups.map((g) => (
          <div key={g}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{g}</p>
            {items.filter((i) => i.group === g).map((i) => (
              <Link key={i.href} href={i.href}
                className={`block rounded-lg px-3 py-2 text-sm ${isActive(path, i) ? "bg-lime-100 font-semibold text-green-900" : "text-neutral-700 hover:bg-neutral-100"}`}>
                {i.label}
              </Link>
            ))}
          </div>
        ))}
      </aside>
    </>
  );
}
