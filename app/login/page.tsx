"use client";
import { use, useActionState } from "react";
import { login } from "./actions";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = use(searchParams);
  const [error, action, pending] = useActionState(login, undefined);
  return (
    <main className="min-h-screen grid place-items-center bg-[#f7f3ea] px-4">
      <form action={action} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl space-y-5">
        <div>
          <p className="text-sm font-semibold tracking-widest text-lime-600">DETOX BOOTH</p>
          <h1 className="text-2xl font-bold text-neutral-900">Вход для сотрудников</h1>
        </div>
        <input name="email" type="email" required placeholder="Email" autoComplete="username"
          className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-green-600" />
        <input name="password" type="password" required placeholder="Пароль" autoComplete="current-password"
          className="w-full rounded-xl border border-neutral-200 px-4 py-3 outline-none focus:border-green-600" />
        {expired && !error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Доступ закрыт или сессия завершена. Войдите снова.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-green-700 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
          {pending ? "Входим..." : "Войти"}
        </button>
      </form>
    </main>
  );
}
