import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentSession } from "@/lib/session";
import { homeFor } from "@/lib/rbac";

export default async function AfterLogin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const fresh = await currentSession();
  if (!fresh) redirect("/api/session-expired");
  redirect(homeFor(fresh.user.role));
}
