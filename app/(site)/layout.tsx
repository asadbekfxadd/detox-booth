import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { CartButton } from "@/components/site/CartButton";
import { LocationSelect } from "@/components/site/LocationSelect";

export const dynamic = "force-dynamic";

function Mark() {
  // Знак: арка-окно киоска с листом внутри.
  return (
    <svg width="30" height="34" viewBox="0 0 28 32" aria-hidden className="shrink-0 transition-transform group-hover:rotate-[-8deg]">
      <path d="M2 31V14C2 7 7.4 1.5 14 1.5S26 7 26 14v17z" fill="#c9f23c" stroke="#14231a" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M14 26c-4.5-1-6.5-5-5.5-10 4.5.2 7.4 2.6 8 6.4M14 26c.4-3.4 1.6-6 4-8" fill="none" stroke="#14231a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const navLink = "rounded-full px-3.5 py-1.5 text-[15px] font-bold transition-colors hover:bg-lime";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { locations, current } = await getSiteLocation();
  return (
    <div className="site flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="DETOX BOOTH — на главную">
            <Mark />
            <span className="display text-[15px] font-extrabold leading-none tracking-tight">DETOX<br className="sm:hidden" /><span className="sm:ml-1.5">BOOTH</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
            <Link href="/menu" className={navLink}>Меню</Link>
            <Link href="/menu?category=smoothies" className={navLink}>Смузи</Link>
            <Link href="/menu?category=bowls" className={navLink}>Боулы</Link>
            <Link href="/menu?category=detox" className={navLink}>Детокс</Link>
            <Link href="/menu?category=sets" className={navLink}>Сеты</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocationSelect locations={locations.map((l) => ({ id: l.id, name: l.name }))} current={current?.id ?? null} />
            <CartButton />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="overflow-hidden border-t-2 border-ink bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-6 pt-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="display text-xl font-extrabold text-lime">DETOX BOOTH</p>
            <p className="mt-2 max-w-xs text-sm text-white/70">Смузи, фреши, боулы и салаты. Готовим сразу после заказа из свежих продуктов.</p>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-bold text-mango">Меню</p>
            <ul className="space-y-1.5 text-white/75">
              <li><Link href="/menu" className="hover:text-white">Всё меню</Link></li>
              <li><Link href="/menu?category=smoothies" className="hover:text-white">Смузи</Link></li>
              <li><Link href="/menu?category=bowls" className="hover:text-white">Боулы</Link></li>
              <li><Link href="/menu?category=sets" className="hover:text-white">Сеты</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-bold text-mango">Точки</p>
            <ul className="space-y-1.5 text-white/75">
              {locations.length === 0 && <li>Скоро откроемся</li>}
              {locations.map((l) => <li key={l.id}>{l.name}{l.address ? `, ${l.address}` : ""}</li>)}
            </ul>
          </div>
        </div>
        <p aria-hidden className="display select-none whitespace-nowrap text-center text-[clamp(2.2rem,9.2vw,9rem)] font-black leading-[0.8] text-lime/90">DETOX BOOTH</p>
        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/60">
            <span>© DETOX BOOTH, Ташкент</span>
            <Link href="/login" className="hover:text-white">Вход для сотрудников</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
