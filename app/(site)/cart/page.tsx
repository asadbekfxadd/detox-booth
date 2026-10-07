import { getSiteLocation } from "@/lib/site";
import { CartView } from "@/components/site/CartView";

export default async function CartPage() {
  const { current } = await getSiteLocation();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Корзина</h1>
      <CartView locationId={current?.id ?? null} />
    </div>
  );
}
