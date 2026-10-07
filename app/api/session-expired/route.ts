import { signOut } from "@/auth";

/** Куда попадает сотрудник, чей доступ отозван: чистим cookie и отправляем на вход. */
export async function GET() {
  await signOut({ redirectTo: "/login?expired=1" });
}
