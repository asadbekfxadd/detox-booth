import Link from "next/link";
import { notFound } from "next/navigation";
import { pageGuard } from "@/lib/guard";
import { getPurchase } from "@/services/purchases";
import { money, qty, unitLabel, dateStr } from "@/lib/format";
import { ActionButton } from "@/components/admin/ActionButton";
import { ReceiveForm } from "@/components/admin/PurchaseForm";
import { STATUS_LABEL, STATUS_CLS } from "@/lib/purchase-status";
import { orderPurchaseAction, cancelPurchaseAction, receivePurchaseAction } from "../actions";

const OK: Record<string, string> = { created: "Закупка создана", ordered: "Заказ оформлен", cancelled: "Заказ отменён", received: "Товар принят на склад, остатки и средняя цена обновлены" };

export default async function PurchasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const user = await pageGuard("purchases.manage");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await getPurchase(id, user);
  if (!p) notFound();
  const open = p.status === "DRAFT" || p.status === "ORDERED";
  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Закупка · {p.supplier}</h1>
        <Link href="/admin/purchases" className="text-sm text-green-800 underline">← К списку</Link>
      </div>
      {sp.ok && OK[sp.ok] && <p className="rounded-lg bg-lime-100 px-4 py-2 text-sm text-green-900">{OK[sp.ok]}</p>}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 text-sm shadow-sm">
        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
        <span>Точка: <b>{p.location}</b></span>
        <span>Создана: <b>{dateStr(p.createdAt)}</b></span>
        {p.receivedAt && <span>Принята: <b>{dateStr(p.receivedAt)}</b></span>}
        <span className="ml-auto text-lg font-bold">{money(p.total)}</span>
      </div>

      {open ? (
        <ReceiveForm action={receivePurchaseAction} purchaseId={p.id}
          lines={p.items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, quantity: i.quantity, unitCost: i.unitCost, expiresAt: i.expiresAt ? i.expiresAt.toISOString().slice(0, 10) : "" }))} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-3">Ингредиент</th><th className="text-right">Количество</th><th className="text-right">Цена за 1 ед.</th><th className="text-right">Сумма</th><th className="p-3">Срок</th></tr></thead>
            <tbody>
              {p.items.map((i) => (
                <tr key={i.id} className="border-t border-neutral-100">
                  <td className="p-3 font-medium">{i.name}</td><td className="text-right">{qty(i.quantity)} {unitLabel(i.unit)}</td>
                  <td className="text-right">{money(i.unitCost)} / {unitLabel(i.unit)}</td><td className="text-right">{money(i.quantity * i.unitCost)}</td>
                  <td className="p-3">{i.expiresAt ? dateStr(i.expiresAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="flex flex-wrap items-start gap-3">
          {p.status === "DRAFT" && <ActionButton action={orderPurchaseAction} fields={{ id: p.id }} label="Оформить заказ" />}
          <ActionButton action={cancelPurchaseAction} fields={{ id: p.id }} label="Отменить закупку" danger confirmText="Отменить закупку?" />
        </div>
      )}
    </div>
  );
}
