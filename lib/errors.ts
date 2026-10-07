import { ZodError } from "zod";
import { ApiError } from "@/lib/api";

/** Текст ошибки для пользователя. Технические детали уходят только в лог сервера. */
export function toMessage(e: unknown): string {
  if (e instanceof ZodError) return e.issues[0]?.message ?? "Некорректные данные";
  if (e instanceof ApiError) return e.message;
  console.error("[ACTION ERROR]", e);
  return "Something went wrong. Please try again.";
}
