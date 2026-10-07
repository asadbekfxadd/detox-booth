"use client";
import { useEffect } from "react";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold">Не удалось загрузить раздел</h1>
      <p className="mt-2 text-sm text-neutral-600">Данные не потеряны. Повторите попытку; если ошибка остаётся, сообщите администратору{error.digest ? ` (код ${error.digest})` : ""}.</p>
      <button onClick={() => retry()} className="mt-4 rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">Повторить</button>
    </div>
  );
}
