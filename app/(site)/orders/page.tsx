import { OrdersList } from "@/components/site/OrdersList";
import { Page } from "@/components/site/Page";

export const metadata = { title: "Мои заказы", robots: { index: false, follow: false } };

export default function OrdersPage() {
  return (
    <Page className="space-y-6">
      <h1 className="text-3xl font-extrabold">Мои заказы</h1>
      <OrdersList />
    </Page>
  );
}
