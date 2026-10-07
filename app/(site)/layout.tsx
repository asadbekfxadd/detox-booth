import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { CartButton } from "@/components/site/CartButton";
import { LocationSelect } from "@/components/site/LocationSelect";

export const dynamic = "force-dynamic";

function Mark() {
  // Знак: арка-окно киоска с листом внутри.
  return (
    <svg width="28" height="32" viewBox="0 0 28 32" aria-hidden className="shrink-0">
      <path d="M2 31V14C2 7 7.4 1.5 14 1.5S26 7 26 14v17z" fill="#d4f26a" stroke="#18281c" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M14 26c-4.5-1-6.5-5-5.5-10 4.5.2 7.4 2.6 8 6.4M14 26c.4-3.4 1.6-6 4-8" fill="none" stroke="#18281c" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { locations, current } = await getSiteLocation();
  return (
    <div className="site flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5" aria-label="DETOX BOOTH — на главную">
            <Mark />
            <span className="display text-[15px] font-extrabold leading-none tracking-tight">DETOX<br className="sm:hidden" /><span className="sm:ml-1.5">BOOTH</span></span>
          </Link>
          <nav className="hidden items-center gap-6 text-[15px] font-semibold md:flex" aria-label="Основная навигация">
            <Link href="/menu" className="hover:text-leaf">Меню</Link>
            <Link href="/menu?category=sets" className="hover:text-leaf">Сеты</Link>
            <Link href="/menu?category=detox" className="hover:text-leaf">Детокс</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocationSelect locations={locations.map((l) => ({ id: l.id, name: l.name }))} current={current?.id ?? null} />
            <CartButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
      <footer className="mt-10 bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="display text-xl font-extrabold">DETOX BOOTH</p>
            <p className="mt-2 max-w-xs text-sm text-white/70">Смузи, фреши, боулы и салаты. Готовим сразу после заказа из свежих продуктов.</p>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-semibold text-lime">Меню</p>
            <ul className="space-y-1.5 text-white/75">
              <li><Link href="/menu" className="hover:text-white">Всё меню</Link></li>
              <li><Link href="/menu?category=smoothies" className="hover:text-white">Смузи</Link></li>
              <li><Link href="/menu?category=bowls" className="hover:text-white">Боулы</Link></li>
              <li><Link href="/menu?category=sets" className="hover:text-white">Сеты</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-semibold text-lime">Точки</p>
            <ul className="space-y-1.5 text-white/75">
              {locations.length === 0 && <li>Скоро откроемся</li>}
              {locations.map((l) => <li key={l.id}>{l.name}{l.address ? `, ${l.address}` : ""}</li>)}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/55">
            <span>© DETOX BOOTH, Ташкент</span>
            <Link href="/login" className="hover:text-white">Вход для сотрудников</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
