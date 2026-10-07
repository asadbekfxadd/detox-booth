"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function login(_prev: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo: "/after-login" });
  } catch (e) {
    if (e instanceof AuthError) return "Неверный email или пароль";
    throw e; // redirect должен пройти
  }
}
