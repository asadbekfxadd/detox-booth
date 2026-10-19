import Link from "next/link";
import type { GuideStep } from "@/services/start-guide";

/** «С чего начать» на Обзоре. Исчезает, когда выполнены все шаги. */
export function StartGuide({ steps }: { steps: GuideStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done);
  return (
    <details open className="group rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-bold">С чего начать <span className="ml-2 text-sm font-normal text-neutral-500">выполнено {done} из {steps.length}</span></span>
        <span className="h-2 w-40 overflow-hidden rounded-full bg-neutral-100" aria-hidden><span className="block h-full bg-green-600" style={{ width: `${(done / steps.length) * 100}%` }} /></span>
      </summary>
      <p className="mt-2 text-sm text-neutral-600">Пройдите шаги по порядку: тогда склад, себестоимость и прибыль будут считаться верно. Галочки ставятся сами, когда данные введены.</p>
      <ol className="mt-4 space-y-3">
        {steps.map((s) => (
          <li key={s.id} className={`flex flex-wrap items-start gap-3 rounded-xl p-3 ${s.id === next?.id ? "bg-lime-50 ring-1 ring-green-300" : ""}`}>
            <span aria-label={s.done ? "Готово" : "Не сделано"} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-green-600 text-white" : "border-2 border-neutral-300 text-transparent"}`}>✓</span>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${s.done ? "text-neutral-400 line-through" : ""}`}>{s.title}</p>
              {!s.done && <p className="text-sm text-neutral-600">{s.help}{s.progress ? ` (${s.progress})` : ""}</p>}
            </div>
            {!s.done && <Link href={s.href} className={`shrink-0 rounded-xl px-4 py-1.5 text-sm font-semibold ${s.id === next?.id ? "bg-green-700 text-white hover:bg-green-800" : "border border-neutral-200 hover:bg-neutral-50"}`}>{s.action}</Link>}
          </li>
        ))}
      </ol>
    </details>
  );
}
