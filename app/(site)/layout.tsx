import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { CartButton } from "@/components/site/CartButton";
import { LocationSelect } from "@/components/site/LocationSelect";
import { Logo } from "@/components/site/Logo";
import { Marquee } from "@/components/site/Marquee";

export const dynamic = "force-dynamic";

const navLink = "rounded-full px-3.5 py-1.5 text-[15px] font-bold text-forest/80 transition-colors hover:bg-sand hover:text-forest";

const TICKER = ["Good juice, good mood", "Натуральные фрукты", "Настоящий вкус", "Без консервантов", "Свежие соки и смузи", "Для взрослых и детей", "Готовим сразу после заказа"];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { locations, current } = await getSiteLocation();
  return (
    <div className="site flex min-h-screen flex-col">
      <Marquee items={TICKER} className="bg-forest-deep py-2 text-white" />
      <header className="sticky top-0 z-30 border-b border-forest/10 bg-cream/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="group" aria-label="Vitamin B — на главную"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
            <Link href="/menu" className={navLink}>Меню</Link>
            <Link href="/locations" className={navLink}>Точки</Link>
            <Link href="/orders" className={navLink}>Мои заказы</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocationSelect locations={locations.map((l) => ({ id: l.id, name: l.name }))} current={current?.id ?? null} />
            <CartButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Разделы">
          <Link href="/menu" className={`${navLink} whitespace-nowrap`}>Меню</Link>
          <Link href="/locations" className={`${navLink} whitespace-nowrap`}>Точки</Link>
          <Link href="/orders" className={`${navLink} whitespace-nowrap`}>Мои заказы</Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="overflow-hidden bg-forest-deep text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-6 pt-12 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="script mt-4 text-3xl text-orange">Good juice, good mood</p>
            <p className="mt-2 max-w-xs text-sm text-white/70">Натуральные фрукты. Настоящий вкус. Готовим сразу после заказа.</p>
          </div>
          <div className="text-sm">
            <p className="mb-3 font-extrabold uppercase tracking-wider text-orange">Меню</p>
            <ul className="space-y-1.5 text-white/75">
              <li><Link href="/menu" className="hover:text-white">Всё меню</Link></li>
              <li><Link href="/menu?category=fresh" className="hover:text-white">Фреши и соки</Link></li>
              <li><Link href="/menu?category=smoothies" className="hover:text-white">Смузи</Link></li>
              <li><Link href="/menu?category=bowls" className="hover:text-white">Боулы</Link></li>
              <li><Link href="/menu?category=sets" className="hover:text-white">Сеты</Link></li>
              <li><Link href="/orders" className="hover:text-white">Мои заказы</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="mb-3 font-extrabold uppercase tracking-wider text-orange">Точки</p>
            <ul className="space-y-1.5 text-white/75">
              {locations.length === 0 && <li>Скоро откроемся</li>}
              {locations.map((l) => <li key={l.id}>{l.name}{l.address ? `, ${l.address}` : ""}</li>)}
            </ul>
          </div>
        </div>
        <p aria-hidden className="display select-none whitespace-nowrap bg-gradient-to-b from-orange to-orange/0 bg-clip-text text-center text-[clamp(2.4rem,15vw,13rem)] font-black leading-[0.85] text-transparent">VITAMIN B</p>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/60">
            <span>© Vitamin B, juice &amp; fresh</span>
            <Link href="/login" className="hover:text-white">Вход для сотрудников</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
