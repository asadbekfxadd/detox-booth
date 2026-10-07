import QRCode from "qrcode";
import { pageGuard } from "@/lib/guard";
import { getScope } from "@/lib/location";
import { listTablesAdmin } from "@/services/tables";
import { siteUrl } from "@/lib/site-url";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Печать QR столов" };

/** Лист для печати: по одной карточке на стол, две в ряд на A4. Разрезать и поставить на столы. */
export default async function PrintTablesPage() {
  await pageGuard("settings.edit");
  const { locationId } = await getScope();
  const tables = (await listTablesAdmin(locationId)).filter((t) => t.isActive);
  const base = siteUrl();
  const items = await Promise.all(tables.map(async (t) => ({ ...t, qr: await QRCode.toDataURL(`${base}/t/${t.token}`, { margin: 1, width: 600, errorCorrectionLevel: "M" }) })));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Печать QR для столов</h1>
        <PrintButton />
      </div>
      <ul className="grid grid-cols-2 gap-4 print:gap-2">
        {items.map((t) => (
          <li key={t.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-3xl border-2 border-green-800 bg-white p-6 text-center">
            <p className="text-sm font-extrabold tracking-wide text-green-800">VITAMIN B · JUICE &amp; FRESH</p>
            <p className="text-5xl font-black">Стол {t.number}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.qr} alt={`QR-код стола ${t.number}`} width={260} height={260} />
            <p className="text-lg font-bold">Наведите камеру и заказывайте с телефона</p>
            <p className="text-sm text-neutral-600">Принесём к столу. Платите в конце одним счётом.</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
