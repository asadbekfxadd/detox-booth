import Link from "next/link";
import { logoutAction } from "@/app/waiter/actions";

/** Шапка экранов официанта: название заведения, имя, выход. Ссылки на кассу/админку только если есть право. */
export function WaiterHeader({ brandName, userName, posHref, adminHref, back }: {
  brandName: string; userName: string; posHref?: string | null; adminHref?: string | null; back?: { href: string; label: string };
}) {
  const link = "rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50";
  return (
    <header className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center gap-2">
      {back ? <Link href={back.href} className={link}>← {back.label}</Link> : <span className="text-lg font-bold text-green-800">{brandName}</span>}
      <span className="text-sm text-neutral-600">{userName}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {posHref && <Link href={posHref} className={link}>Касса</Link>}
        {adminHref && <Link href={adminHref} className={link}>Админка</Link>}
        <form action={logoutAction}><button className={link}>Выйти</button></form>
      </div>
    </header>
  );
}
