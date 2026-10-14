"use client";
import Link from "next/link";
import { sum } from "@/lib/format";
import type { Advice, UpsellPick } from "@/lib/upsell";
import { MandarinCharacter } from "./mandarin/MandarinCharacter";
import { ProductImage } from "./ProductImage";
import { QuickAdd } from "./QuickAdd";

/** Полоса прогресса «до скидки» или «до бесплатной доставки». Доля считается от порога, не больше 100%. */
export function GoalBar({ current, target, label }: { current: number; target: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round((current / Math.max(1, target)) * 100)));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(target)} aria-valuenow={Math.round(Math.min(current, target))} className="h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-forest/10">
      <div className="h-full rounded-full bg-linear-to-r from-sun to-orange transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Строка предложения: фото, название, цена и кнопка «+» (или «Выбрать», если нужно выбрать вариант). */
export function PickRow({ pick }: { pick: UpsellPick }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-forest/10">
      <div className="w-12 shrink-0"><ProductImage image={pick.image} name={pick.name} categorySlug={pick.categorySlug} shape="thumb" /></div>
      <div className="min-w-0 flex-1">
        <Link href={`/menu/${pick.slug}`} className="line-clamp-2 text-sm font-bold leading-tight hover:underline">{pick.name}</Link>
        <p className="text-xs font-semibold text-forest/70">{pick.needsChoice && "от "}{sum(pick.price)}</p>
      </div>
      {pick.needsChoice
        ? <Link href={`/menu/${pick.slug}`} className="btn btn-ghost !px-3 !py-1.5 text-sm">Выбрать</Link>
        : <QuickAdd productId={pick.id} optionIds={pick.optionIds} available name={pick.name} />}
    </li>
  );
}

/**
 * «Мандаринка советует»: реплика, при необходимости полоса до скидки и 1–3 позиции с кнопкой «+».
 * cheer — короткая радость, когда акция только что сработала. mascot выключен, если владелец отключил помощницу в настройках.
 */
export function CartAdvice({ advice, cheer, mascot }: { advice: Advice | null; cheer: string | null; mascot: boolean }) {
  if (!advice && !cheer) return null;
  return (
    <section aria-label="Совет" className="rounded-2xl bg-linear-to-br from-sun/35 to-orange/20 p-4 ring-1 ring-orange/40">
      <div className="flex items-start gap-3">
        {mascot && <div className="h-20 w-16 shrink-0" aria-hidden><MandarinCharacter state={cheer ? "point" : "talk"} face={1} /></div>}
        <div className="min-w-0 flex-1 space-y-2">
          {cheer && <p role="status" className="rounded-2xl rounded-bl-md bg-forest px-3.5 py-2 text-sm font-bold text-white">{cheer}</p>}
          {advice && (
            <>
              <p className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm font-bold leading-snug text-forest-deep ring-1 ring-forest/10">{advice.text}</p>
              {advice.progress && (
                <div className="space-y-1">
                  <GoalBar current={advice.progress.current} target={advice.progress.target} label="Сколько набрано до скидки" />
                  <p className="flex justify-between text-xs font-semibold text-forest/70"><span>{sum(advice.progress.current)}</span><span>{sum(advice.progress.target)}</span></p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {advice && advice.picks.length > 0 && <ul className="mt-3 grid gap-2 sm:grid-cols-3">{advice.picks.map((p) => <PickRow key={p.id} pick={p} />)}</ul>}
    </section>
  );
}
