import Link from "next/link";
import { getSiteLocation } from "@/lib/site";
import { CheckoutForm } from "@/components/site/CheckoutForm";

export default async function CheckoutPage() {
  const { current } = await getSiteLocation();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/cart" className="text-sm text-neutral-500 hover:text-neutral-900">← Назад в корзину</Link>
        <h1 className="text-3xl font-extrabold">Оформление заказа</h1>
      </div>
      {current
        ? <CheckoutForm locationName={current.name} locationId={current.id} />
        : <p className="rounded-2xl bg-white p-6 shadow-sm">Сейчас нет доступных точек для заказа.</p>}
    </div>
  );
}
