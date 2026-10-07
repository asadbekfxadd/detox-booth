"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { closeBill } from "@/services/tables";
import { advanceOrder } from "@/services/orders";

const back = (tableId: string, error?: string) => redirect(`/pos/tables/${tableId}${error ? `?error=${encodeURIComponent(error)}` : ""}`);

/** Закрыть счёт стола: оплата наличными или картой, всё одним действием. */
export async function closeBillAction(fd: FormData): Promise<void> {
  const tableId = String(fd.get("tableId") ?? "");
  let done: { total: number; orders: number } | null = null;
  try {
    const u = await requireUser("pos.use");
    done = await closeBill({ billId: String(fd.get("billId") ?? ""), method: String(fd.get("method") ?? "") }, u);
  } catch (e) { return back(tableId, toMessage(e)); }
  revalidatePath("/pos/tables");
  redirect(`/pos/tables?paid=${done.total}`);
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
