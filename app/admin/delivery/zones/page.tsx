import Link from "next/link";
import { pageGuard, formLocations } from "@/lib/guard";
import { FormShell } from "@/components/admin/ops";
import { ZoneFields } from "@/components/admin/ZoneFields";
import { ActionButton } from "@/components/admin/ActionButton";
import { listZones } from "@/services/delivery";
import { sum } from "@/lib/format";
import { createZoneAction, deleteZoneAction } from "./actions";

const OK: Record<string, string> = { created: "Зона добавлена", updated: "Изменения сохранены", deleted: "Зона удалена" };
export const metadata = { title: "Зоны доставки" };

export default async function ZonesPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await pageGuard("settings.edit");
  const sp = await searchParams;
  const { options, locationId } = await formLocations();
  const zones = await listZones(locationId);
  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Зоны доставки</h1>
        <Link href="/admin/delivery" className="rounded-xl border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold hover:bg-neutral-50">К доставке</Link>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <p className="text-sm text-neutral-600">Если у точки есть активные зоны, клиент на сайте выбирает зону, а цена доставки считается по ней: фиксированная цена, минимальный заказ и порог бесплатной доставки. Если зон нет, действует общая цена из «Настроек».</p>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-3">Зона</th><th>Точка</th><th className="text-right">Цена</th><th className="text-right">Минимум</th><th className="text-right">Бесплатно от</th><th className="p-3 text-right">Действия</th></tr></thead>
          <tbody>
            {zones.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-neutral-500">Зон пока нет. Добавьте первую ниже.</td></tr>}
            {zones.map((z) => (
              <tr key={z.id} className={`border-t border-neutral-100 ${z.isActive ? "" : "opacity-50"}`}>
                <td className="p-3 font-medium">{z.name}{!z.isActive && <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs">выключена</span>}</td>
                <td className="text-neutral-600">{z.location.name}</td>
                <td className="text-right">{Number(z.fee) > 0 ? sum(Number(z.fee)) : "бесплатно"}</td>
                <td className="text-right">{Number(z.minOrder) > 0 ? sum(Number(z.minOrder)) : "—"}</td>
                <td className="text-right">{z.freeFrom != null ? sum(Number(z.freeFrom)) : "—"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <Link href={`/admin/delivery/zones/${z.id}`} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50">Изменить</Link>
                    <ActionButton action={deleteZoneAction} fields={{ id: z.id }} label="Удалить" danger confirmText={`Удалить зону «${z.name}»?`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-lg font-bold">Добавить зону</h2>
      <FormShell action={createZoneAction} submitLabel="Добавить" cancelHref="/admin/delivery/zones">
        <ZoneFields locations={options} z={{ locationId: locationId ?? undefined }} />
      </FormShell>
    </div>
  );
}
