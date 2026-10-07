"use server";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { advanceOrder } from "@/services/orders";
import type { OpState } from "@/components/admin/ops";

export async function kitchenAdvanceAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("orders.manage");
    await advanceOrder({ id: String(fd.get("id") ?? ""), to: String(fd.get("to") ?? "") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/kitchen"); revalidatePath("/admin/orders"); revalidatePath("/admin/inventory");
  return undefined;
}

export async function kitchenLogoutAction() {
  await signOut({ redirectTo: "/login" });
}
