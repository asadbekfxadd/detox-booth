"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/api";
import { toMessage } from "@/lib/errors";
import { writeOff } from "@/services/inventory";
import type { OpState } from "@/components/admin/ops";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function writeOffAction(_p: OpState, fd: FormData): Promise<OpState> {
  try {
    const u = await requireUser("writeoffs.create");
    await writeOff({ locationId: s(fd, "locationId"), ingredientId: s(fd, "ingredientId"), quantity: s(fd, "quantity"), reason: s(fd, "reason") }, u);
  } catch (e) { return { error: toMessage(e) }; }
  revalidatePath("/admin/writeoffs");
  revalidatePath("/admin/inventory");
  redirect("/admin/writeoffs?ok=1");
}
