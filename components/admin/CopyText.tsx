"use client";
import { useState } from "react";

/** Готовый текст, который копируется в буфер одной кнопкой: например, заказ поставщику для мессенджера. */
export function CopyText({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold">{label}</p>
      <textarea readOnly value={text} rows={Math.min(14, text.split("\n").length + 1)} className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm" aria-label={label} />
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* буфер недоступен: текст можно выделить и скопировать руками */ } }}
        className="rounded-xl border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50">{done ? "Скопировано" : "Скопировать"}</button>
    </div>
  );
}
