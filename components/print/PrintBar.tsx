"use client";
import { useEffect } from "react";

/** Панель над чеком: кнопка «Печать». С ?auto=1 диалог печати открывается сразу (для автопечати на кухне). Сама панель на бумагу не попадает. */
export function PrintBar({ auto, closeAfter }: { auto: boolean; closeAfter?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => { window.print(); }, 300);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-center gap-3 print:hidden">
      <button onClick={() => window.print()} className="min-h-12 rounded-xl bg-green-700 px-6 font-bold text-white">Печать</button>
      {closeAfter && <button onClick={() => window.close()} className="min-h-12 rounded-xl border border-neutral-300 bg-white px-6 font-semibold">Закрыть</button>}
      <p className="w-full text-center text-xs text-neutral-500">Лента 80 мм. В диалоге печати уберите колонтитулы и поля.</p>
    </div>
  );
}
