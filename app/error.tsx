"use client";
import { useEffect } from "react";

export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f3ea] px-4">
      <div role="alert" className="max-w-sm rounded-3xl bg-white p-10 text-center shadow-sm">
        <h1 className="text-xl font-bold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-neutral-600">Мы уже знаем о сбое. Попробуйте обновить страницу.</p>
        <button onClick={() => retry()} className="mt-5 rounded-full bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800">Повторить</button>
      </div>
    </main>
  );
}
