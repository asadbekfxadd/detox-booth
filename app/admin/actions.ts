"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { currentSession } from "@/lib/session";
import { canSwitchLocation } from "@/lib/rbac";

export async function setLocation(id: string) {
  const session = await currentSession();
  if (!session || !canSwitchLocation(session.user.role)) return; // выбирать точку могут владелец и склад
  (await cookies()).set("loc", id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/admin", "layout");
}
