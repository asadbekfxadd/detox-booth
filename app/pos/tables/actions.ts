"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { closeBill } from "@/services/tables";
import { advanceOrder } from "@/services/orders";
import { voidOrderItem } from "@/services/void-item";

const back = (tableId: string, error?: string) => redirect(`/pos/tables/${tableId}${error ? `?error=${encodeURIComponent(error)}` : ""}`);

/** Принять оплату: за весь стол или только за отмеченные заказы; с чаевыми. */
export async function closeBillAction(fd: FormData): Promise<void> {
  const tableId = String(fd.get("tableId") ?? "");
  let done: Awaited<ReturnType<typeof closeBill>>;
  try {
    const u = await requireUser("pos.use");
    const ids = fd.getAll("orderId").map(String);
    done = await closeBill({
      billId: String(fd.get("billId") ?? ""), method: String(fd.get("method") ?? ""),
      orderIds: fd.get("split") === "1" ? ids : undefined, tip: String(fd.get("tip") ?? "").replace(",", ".").replace(/\s/g, ""),
    }, u);
  } catch (e) { return back(tableId, toMessage(e)); }
  revalidatePath("/pos/tables");
  const tip = done.tip > 0 ? `&tip=${done.tip}` : "";
  if (done.closed) redirect(`/pos/tables?paid=${done.total}${tip}`);
  redirect(`/pos/tables/${tableId}?paid=${done.total}${tip}`);
}

/** Отметить заказ поданным (готово → подано), не дожидаясь оплаты. */
export async function serveOrderAction(fd: FormData): Promise<void> {
  const tableId = String(fd.get("tableId") ?? "");
  try {
    const u = await requireUser("orders.manage");
    await advanceOrder({ id: String(fd.get("orderId") ?? ""), to: "COMPLETED" }, u);
  } catch (e) { return back(tableId, toMessage(e)); }
  revalidatePath(`/pos/tables/${tableId}`);
  back(tableId);
}

/** Отменить позицию в заказе стола (после отправки на кухню нужен менеджер). */
export async function voidItemAction(fd: FormData): Promise<void> {
  const tableId = String(fd.get("tableId") ?? "");
  try {
    const u = await requireUser("pos.use");
    await voidOrderItem({
      orderItemId: String(fd.get("orderItemId") ?? ""), quantity: fd.get("quantity") ?? "", reason: String(fd.get("reason") ?? ""),
      approverEmail: String(fd.get("approverEmail") ?? ""), approverPassword: String(fd.get("approverPassword") ?? ""),
    }, u);
  } catch (e) { return back(tableId, toMessage(e)); }
  revalidatePath(`/pos/tables/${tableId}`);
  back(tableId);
}
