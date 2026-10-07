"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { clientIp } from "@/lib/client-ip";
import { hit, reset } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

const WINDOW = 15 * 60_000;

export async function login(_prev: string | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 120);
  const ip = await clientIp();
  // перебор пароля: ограничиваем и по адресу, и по логину (чтобы не блокировать чужой аккаунт с одного IP-пула навсегда — окно 15 минут)
  const byIp = hit(`login:ip:${ip}`, 30, WINDOW);
  const byEmail = hit(`login:email:${email}`, 8, WINDOW);
  if (!byIp.ok || !byEmail.ok) {
    const min = Math.ceil(Math.max(byIp.retryAfterSec, byEmail.retryAfterSec) / 60);
    return `Слишком много попыток входа. Повторите через ${min} мин.`;
  }
  try {
    await signIn("credentials", { email, password: formData.get("password"), redirectTo: "/after-login" });
  } catch (e) {
    if (e instanceof AuthError) {
      await audit({ action: "LOGIN_FAILED", entity: "User", newValue: { email }, ip });
      return "Неверный email или пароль";
    }
    reset(`login:email:${email}`);
    throw e; // redirect должен пройти
  }
}
