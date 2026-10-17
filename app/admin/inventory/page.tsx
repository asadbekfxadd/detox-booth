import Link from "next/link";
import { currentSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getScope } from "@/lib/location";
import { getStockOverview } from "@/services/inventory";
import { StockTable } from "@/components/admin/StockTable";
import { nowMs } from "@/lib/time";

const OK: Record<string, string> = {
  stockin: "Приход оформлен", transfer: "Перемещение выполнено",
  ing_created: "Продукт добавлен", ing_updated: "Изменения сохранены", ing_deleted: "Продукт удалён",
};
const btn = "rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50";

/** «Склад»: все продукты с остатками и сроками в одной таблице; приход, закупки, списания и поставщики открываются вкладками выше. */
export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ ok?: string; n?: string }> }) {
  const sp = await searchParams;
  const user = (await currentSession())!.user;
  const { locationId } = await getScope();
  const rows = await getStockOverview(locationId);
  const edit = can(user.role, "inventory.edit");
  const purchases = can(user.role, "purchases.manage");
  const showCost = can(user.role, "products.cost");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Склад</h1>
          <p className="text-sm text-neutral-500">Все продукты, остатки и сроки. Приход, закупки, списания и поставщики — во вкладках выше.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {edit && <Link href="/admin/inventory/receive" className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">+ Приход</Link>}
          {edit && <Link href="/admin/ingredients/new" className={btn}>+ Новый продукт</Link>}
          {purchases && <Link href="/admin/purchases/new" className={btn}>Заказать у поставщика</Link>}
          {edit && <Link href="/admin/inventory/transfer" className={btn}>Перемещение</Link>}
          {edit && <Link href="/admin/inventory/count" className={btn}>Инвентаризация</Link>}
        </div>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}{sp.ok === "stockin" && Number(sp.n) > 0 ? `: ${Number(sp.n)} поз.` : ""}</p>}
      <StockTable
        rows={rows.map(({ nearestExpiry, ...r }) => ({ ...r, expiry: nearestExpiry ? nearestExpiry.getTime() : null }))}
        now={nowMs()} showCost={showCost} edit={edit}
      />
    </div>
  );
}
