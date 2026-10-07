import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { currentSession } from "@/lib/session";
import { can, type Permission } from "@/lib/rbac";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Использовать в каждом API-хендлере: проверка входа и права. */
export async function requireUser(permission?: Permission) {
  const session = await currentSession();
  if (!session) throw new ApiError(401, "Требуется вход");
  if (permission && !can(session.user.role, permission)) throw new ApiError(403, "Недостаточно прав");
  return session.user;
}

/** Единая обработка ошибок: пользователю — понятный текст, технические детали — в лог. */
export function handleError(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  console.error("[API ERROR]", e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
