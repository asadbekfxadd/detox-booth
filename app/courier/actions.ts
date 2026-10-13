"use server";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { claimOrder, releaseOrder, pickUpOrder, deliverOrder } from "@/services/delivery";
import type { OpState } from "@/components/admin/ops";

type User = Awaited<ReturnType<typeof requireUser>>;

async function run(fd: FormData, fn: (id: string, u: User) => Promise<unknown>): Promise<OpState> {
  try { const u = await requireUser("courier.use"); await fn(String(fd.get("id") ?? ""), u); }
  catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/courier"); revalidatePath("/admin/delivery"); revalidatePath("/kitchen");
  return undefined;
}

export async function claimAction(_p: OpState, fd: FormData): Promise<OpState> { return run(fd, claimOrder); }
export async function releaseAction(_p: OpState, fd: FormData): Promise<OpState> { return run(fd, releaseOrder); }
export async function pickUpAction(_p: OpState, fd: FormData): Promise<OpState> { return run(fd, pickUpOrder); }
export async function deliverAction(_p: OpState, fd: FormData): Promise<OpState> { return run(fd, deliverOrder); }

export async function courierLogoutAction() {
  await signOut({ redirectTo: "/login" });
}
