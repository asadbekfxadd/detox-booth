import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canSwitchLocation } from "@/lib/rbac";

/** Какая точка сейчас выбрана. OWNER выбирает любую или «все»; остальные привязаны к своей точке. */
export async function getScope() {
  const session = await currentSession();
  if (!session) redirect("/api/session-expired");
  const user = session.user;
  const locations = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const canSwitch = canSwitchLocation(user.role);
  let locationId: string | null = null; // null = все точки
  if (canSwitch) {
    const c = (await cookies()).get("loc")?.value;
    locationId = c && locations.some((l) => l.id === c) ? c : null;
  } else {
    locationId = user.locationId;
  }
  return { user, locations, locationId, canSwitch };
}
