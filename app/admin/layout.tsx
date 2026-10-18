import type { Metadata } from "next";
import { getBrand } from "@/services/brand";
import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { NAV } from "@/components/admin/nav";
import { Sidebar } from "@/components/admin/Sidebar";
import { LocationSwitcher } from "@/components/admin/LocationSwitcher";
import { WarehouseTabs } from "@/components/admin/WarehouseTabs";
import { WAREHOUSE_TABS } from "@/components/admin/warehouse-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return { title: { default: "Админка", template: `%s · Админка ${b.name}` }, robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [{ user, locations, locationId, canSwitch }, brand] = await Promise.all([getScope(), getBrand()]);
  const items = NAV.filter((i) => can(user.role, i.perm));
  const tabs = WAREHOUSE_TABS.filter((t) => can(user.role, t.perm)).map(({ label, href, match }) => ({ label, href, match }));
  const unread = await prisma.notification.count({
    where: { isRead: false, ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}) },
  });
  return (
    <div className="min-h-screen bg-[#f7f3ea] md:flex">
      <Sidebar items={items} brandName={brand.name} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 py-2 sm:gap-3 sm:px-6 sm:py-3 print:hidden">
          <div className="min-w-0 flex-1">
            {canSwitch
              ? <LocationSwitcher locations={locations.map((l) => ({ id: l.id, name: l.name }))} current={locationId} />
              : <span className="block truncate text-sm font-medium">{locations.find((l) => l.id === locationId)?.name ?? "Все точки"}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-4">
            <span title="Непрочитанные уведомления" className="rounded-full bg-lime-100 px-3 py-1 font-semibold text-green-900">🔔 {unread}</span>
            <span className="hidden sm:inline"><b>{user.name}</b> · {user.role}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button className="min-h-10 rounded-lg border border-neutral-200 px-3 py-1.5 hover:bg-neutral-50">Выйти</button>
            </form>
          </div>
        </header>
        {/* Телефон: таблицы прокручиваются вбок внутри своего блока, а не раздвигают страницу; поля 16px, чтобы iOS не увеличивал экран при вводе */}
        <main className="p-3 sm:p-6 print:p-0 max-md:[&_table]:block max-md:[&_table]:max-w-full max-md:[&_table]:overflow-x-auto max-md:[&_th]:whitespace-nowrap max-md:[&_th]:px-3 max-md:[&_td]:px-3 max-md:[&_input:not([type=checkbox]):not([type=radio])]:text-base max-md:[&_select]:text-base max-md:[&_textarea]:text-base"><WarehouseTabs tabs={tabs} />{children}</main>
      </div>
    </div>
  );
}
