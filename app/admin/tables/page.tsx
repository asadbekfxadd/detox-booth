import Link from "next/link";
import QRCode from "qrcode";
import { pageGuard } from "@/lib/guard";
import { getScope } from "@/lib/location";
import { listTablesAdmin } from "@/services/tables";
import { siteUrl } from "@/lib/site-url";
import { addTableAction, toggleTableAction, resetTokenAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Столы и QR" };

export default async function TablesAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await pageGuard("settings.edit");
  const { ok, error } = await searchParams;
  const { locationId, locations } = await getScope();
  const targetLocation = locationId ?? locations[0]?.id ?? "";
  const tables = await listTablesAdmin(locationId);
  const base = siteUrl();
  const local = /localhost|127\.0\.0\.1/.test(base);
  const items = await Promise.all(tables.map(async (t) => {
    const url = `${base}/t/${t.token}`;
    return { ...t, url, qr: await QRCode.toDataURL(url, { margin: 2, width: 360, errorCorrectionLevel: "M" }) };
  }));
  const btn = "rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Столы и QR-коды</h1>
          <p className="text-sm text-neutral-500">Гость сканирует QR на столе, заказывает с телефона, а заказы копятся в счёте стола. Кассир закрывает счёт в разделе «Касса → Столы».</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/tables/print" className="rounded-xl bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800">Печать всех QR</Link>
          <form action={addTableAction}><input type="hidden" name="locationId" value={targetLocation} /><button className="rounded-xl border border-green-700 px-5 py-2.5 font-semibold text-green-800 hover:bg-green-50">Добавить стол</button></form>
        </div>
      </div>
      {ok && <p role="status" className="rounded-xl bg-lime-100 px-4 py-2 text-sm text-green-900">{ok}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-100 px-4 py-2 text-sm text-red-800">{error}</p>}
      {local && <p className="rounded-xl bg-amber-100 px-4 py-2 text-sm text-amber-900">Адрес сайта в QR сейчас {base}. Задайте переменную SITE_URL с настоящим адресом сайта, иначе QR на столах не откроется у гостей.</p>}
      {items.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-neutral-600">Столов нет. Нажмите «Добавить стол».</p>}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((t) => (
          <li key={t.id} className={`space-y-3 rounded-2xl bg-white p-4 shadow-sm ${t.isActive ? "" : "opacity-60"}`}>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-black">Стол {t.number}</p>
              <span className="text-xs text-neutral-500">{t.location}{!t.isActive && " · выключен"}{t.hasOpenBill && " · открыт счёт"}</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.qr} alt={`QR-код стола ${t.number}`} width={180} height={180} className="mx-auto" />
            <p className="break-all text-center text-[11px] text-neutral-400">{t.url}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <form action={toggleTableAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="active" value={t.isActive ? "0" : "1"} /><button className={btn}>{t.isActive ? "Выключить" : "Включить"}</button></form>
              <form action={resetTokenAction}><input type="hidden" name="id" value={t.id} /><button className={btn} title="Старый QR перестанет работать">Новый QR</button></form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
