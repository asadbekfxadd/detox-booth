"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar({ items }: { items: { label: string; href: string; group: string }[] }) {
  const path = usePathname();
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <>
    <nav className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-3 py-2 md:hidden print:hidden" aria-label="Разделы">
      {items.map((i) => {
        const active = path === i.href || path.startsWith(i.href + "/");
        return <Link key={i.href} href={i.href} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${active ? "bg-lime-100 font-semibold text-green-900" : "bg-neutral-100 text-neutral-700"}`}>{i.label}</Link>;
      })}
    </nav>
    <aside className="hidden md:flex print:!hidden w-60 shrink-0 flex-col gap-5 border-r border-neutral-200 bg-white p-4">
      <div className="px-2">
        <p className="text-lg font-extrabold tracking-wide text-green-800">Vitamin B</p>
        <p className="text-xs text-neutral-500">Панель управления</p>
      </div>
      {groups.map((g) => (
        <div key={g}>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{g}</p>
          {items.filter((i) => i.group === g).map((i) => {
            const active = path === i.href || path.startsWith(i.href + "/");
            return (
              <Link key={i.href} href={i.href}
                className={`block rounded-lg px-3 py-2 text-sm ${active ? "bg-lime-100 font-semibold text-green-900" : "text-neutral-700 hover:bg-neutral-100"}`}>
                {i.label}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
    </>
  );
}
