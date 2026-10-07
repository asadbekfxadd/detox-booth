import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { CheckoutForm } from "@/components/site/CheckoutForm";
import { Page } from "@/components/site/Page";

export default async function CheckoutPage() {
  const { current } = await getSiteLocation();
  return (
    <Page className="space-y-6">
      <div>
        <Link href="/cart" className="text-sm text-muted hover:text-ink">← Назад в корзину</Link>
        <h1 className="text-3xl font-extrabold">Оформление заказа</h1>
      </div>
      {current
        ? <CheckoutForm locationName={current.name} locationId={current.id} />
        : <p className="rounded-2xl bg-white p-6 pop">Сейчас нет доступных точек для заказа.</p>}
    </Page>
  );
}
