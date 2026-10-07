import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { enabledProviders } from "@/services/payments";
import { CheckoutForm } from "@/components/site/CheckoutForm";
import { TableCheckoutForm } from "@/components/site/TableCheckoutForm";
import { getCurrentTable } from "@/lib/site-table";
import { Page } from "@/components/site/Page";

export const metadata = { title: "Оформление заказа", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const { current } = await getSiteLocation();
  const table = await getCurrentTable();
  const lead = (await prisma.setting.findUnique({ where: { key: "orders.minLeadMinutes" } }))?.value;
  return (
    <Page className="space-y-6">
      <div>
        <Link href="/cart" className="text-sm text-forest/60 hover:text-orange-deep">← Назад в корзину</Link>
        <h1 className="text-3xl font-extrabold">{table ? `Заказ за столом №${table.number}` : "Оформление заказа"}</h1>
      </div>
      {table
        ? <TableCheckoutForm tableNumber={table.number} />
        : current
        ? <CheckoutForm locationName={current.name} locationId={current.id} leadMin={typeof lead === "number" ? lead : 15} online={enabledProviders().length > 0} />
        : <p className="rounded-2xl bg-white p-6 pop">Сейчас нет доступных точек для заказа.</p>}
    </Page>
  );
}
