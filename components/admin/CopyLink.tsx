"use client";
import { useState } from "react";

/** Кнопка «Скопировать» для ссылки. Без доступа к буферу обмена показывает ссылку, чтобы выделить вручную. */
export function CopyLink({ value }: { value: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button type="button" className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
      onClick={async () => { try { await navigator.clipboard.writeText(value); setState("ok"); } catch { setState("fail"); } setTimeout(() => setState("idle"), 2500); }}>
      {state === "ok" ? "Скопировано" : state === "fail" ? "Не вышло, выделите ссылку" : "Скопировать ссылку"}
    </button>
  );
}
