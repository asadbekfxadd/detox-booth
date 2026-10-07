import { redirect } from "next/navigation";
import { currentSession } from "@/lib/session";
import { can, type Permission } from "@/lib/rbac";
import { getScope } from "@/lib/location";

/** Для страниц: нет входа -> /login, нет права -> /forbidden. */
export async function pageGuard(p: Permission) {
  const s = await currentSession();
  if (!s) redirect("/api/session-expired");
  if (!can(s.user.role, p)) redirect("/forbidden");
  return s.user;
}

/** Точки, доступные в формах: владелец видит все, остальные только свою. */
export async function formLocations() {
  const s = await getScope();
  const options = (s.canSwitch ? s.locations : s.locations.filter((l) => l.id === s.user.locationId)).map((l) => ({ id: l.id, name: l.name }));
  return { ...s, options, defaultId: s.locationId ?? options[0]?.id ?? "" };
}
