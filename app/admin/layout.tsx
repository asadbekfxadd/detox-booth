import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { NAV } from "@/components/admin/nav";
import { Sidebar } from "@/components/admin/Sidebar";
import { LocationSwitcher } from "@/components/admin/LocationSwitcher";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, locations, locationId, canSwitch } = await getScope();
  const items = NAV.filter((i) => can(user.role, i.perm));
  const unread = await prisma.notification.count({
    where: { isRead: false, ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}) },
  });
  return (
    <div className="min-h-screen bg-[#f7f3ea] md:flex">
      <Sidebar items={items} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-6 py-3">
          {canSwitch
            ? <LocationSwitcher locations={locations.map((l) => ({ id: l.id, name: l.name }))} current={locationId} />
            : <span className="text-sm font-medium">{locations.find((l) => l.id === locationId)?.name ?? "Все точки"}</span>}
          <div className="flex items-center gap-4 text-sm">
            <span title="Непрочитанные уведомления" className="rounded-full bg-lime-100 px-3 py-1 font-semibold text-green-900">🔔 {unread}</span>
            <span><b>{user.name}</b> · {user.role}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button className="rounded-lg border border-neutral-200 px-3 py-1.5 hover:bg-neutral-50">Выйти</button>
            </form>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
