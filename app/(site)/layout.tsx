import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { CartButton } from "@/components/site/CartButton";
import { LocationSelect } from "@/components/site/LocationSelect";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { locations, current } = await getSiteLocation();
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f3ea] text-neutral-900">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-extrabold tracking-wide text-green-800">DETOX BOOTH</Link>
            <nav className="hidden gap-4 text-sm font-medium sm:flex">
              <Link href="/menu" className="hover:text-green-800">Меню</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LocationSelect locations={locations.map((l) => ({ id: l.id, name: l.name }))} current={current?.id ?? null} />
            <CartButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-neutral-500">
          <span>© DETOX BOOTH · Здоровая еда и напитки</span>
          <Link href="/login" className="hover:text-neutral-800">Вход для сотрудников</Link>
        </div>
      </footer>
    </div>
  );
}
