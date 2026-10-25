"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { createDraftOrders } from "@/services/auto-order";
import type { OpState } from "@/components/admin/ops";

export async function createDraftsAction(_p: OpState, fd: FormData): Promise<OpState> {
  let n = 0;
  try {
    const u = await requireUser("purchases.manage");
    let body: unknown;
    try { body = JSON.parse(String(fd.get("payload") ?? "")); } catch { return { error: "Некорректные данные формы" }; }
    n = (await createDraftOrders(body, u)).length;
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/purchases");
  redirect(`/admin/purchases?status=DRAFT&ok=auto&n=${n}`);
}
