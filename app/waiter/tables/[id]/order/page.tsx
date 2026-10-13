import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { canSwitchLocation } from "@/lib/rbac";
import { getCatalog } from "@/services/pos";
import { WaiterOrderForm } from "@/components/waiter/WaiterOrderForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новый заказ" };

export default async function WaiterOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageGuard("waiter.use");
  const { id } = await params;
  const table = await prisma.diningTable.findUnique({ where: { id } });
  if (!table || !table.isActive) notFound();
  if (!canSwitchLocation(user.role) && user.locationId !== table.locationId) notFound();
  const catalog = await getCatalog(table.locationId);
  return <WaiterOrderForm tableId={table.id} tableNumber={table.number} catalog={catalog} />;
}
