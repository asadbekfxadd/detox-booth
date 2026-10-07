"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { lineKey, useCart } from "@/lib/cart-store";
import { sum } from "@/lib/format";
import { quoteCartAction } from "@/app/(site)/actions";
import type { CartQuote } from "@/services/catalog";
import { ProductImage } from "./ProductImage";
import { QuickAdd } from "./QuickAdd";

export function CartView({ locationId }: { locationId: string | null }) {
  const { lines, setQty, remove, clear } = useCart();
  const [mounted, setMounted] = useState(false);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const sig = JSON.stringify(lines);
  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    (async () => {
      const r = await quoteCartAction(lines);
      if (!alive) return;
      if ("error" in r) { setError(r.error); return; }
      setError(null); setQuote(r.quote);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, sig, locationId]);

  if (!mounted) return <p className="py-16 text-center text-forest/60">Загружаем корзину…</p>;
  if (lines.length === 0)
    return (
      <div className="rounded-2xl bg-white p-10 text-center pop">
        <p className="text-5xl">🛒</p>
        <p className="mt-3 text-lg font-bold">В корзине пока пусто</p>
        <Link href="/menu" className="btn btn-primary pop mt-4">Выбрать в меню</Link>
      </div>
    );
  if (error) return <p className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</p>;
  if (!quote) return <p className="py-16 text-center text-forest/60">Считаем стоимость…</p>;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {quote.lines.map((l) => {
            const key = lineKey(l);
            return (
              <div key={key} className={`flex gap-4 rounded-2xl bg-white p-4 pop ${l.problem ? "ring-4 ring-red-300" : ""}`}>
                <div className="w-16 shrink-0"><ProductImage image={l.image} name={l.name} categorySlug={l.categorySlug || "none"} shape="thumb" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3">
                    <div>
                      {l.slug ? <Link href={`/menu/${l.slug}`} className="font-bold hover:underline">{l.name}</Link> : <p className="font-bold">{l.name}</p>}
                      {l.optionNames.length > 0 && <p className="text-sm text-forest/60">{l.optionNames.join(", ")}</p>}
                    </div>
                    <p className="whitespace-nowrap font-bold">{l.problem ? "—" : sum(l.lineTotal)}</p>
                  </div>
                  {l.problem && <p className="mt-1 text-sm text-red-600">{l.problem}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center rounded-xl border border-forest/20 bg-white font-bold">
                      <button aria-label="Меньше" className="px-3 py-1" onClick={() => setQty(key, l.quantity - 1)}>−</button>
                      <span className="w-7 text-center text-sm font-semibold">{l.quantity}</span>
                      <button aria-label="Больше" className="px-3 py-1" onClick={() => setQty(key, l.quantity + 1)}>+</button>
                    </div>
                    <button className="text-sm text-forest/60 underline hover:text-red-600" onClick={() => remove(key)}>Удалить</button>
                  </div>
                </div>
              </div>
            );
          })}
          <button className="text-sm text-forest/60 underline" onClick={() => { if (confirm("Очистить корзину?")) clear(); }}>Очистить корзину</button>
        </div>
        <aside className="h-fit space-y-3 rounded-2xl bg-white p-5 pop lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Ваш заказ</h2>
          <p className="flex justify-between text-sm text-forest/60"><span>Сумма</span><span>{sum(quote.subtotal)}</span></p>
          <p className="text-xs text-forest/60">Доставка и скидки считаются при оформлении.</p>
          <p className="flex justify-between border-t pt-3 text-lg font-bold"><span>Итого</span><span>{sum(quote.subtotal)}</span></p>
          {quote.ok
            ? <Link href="/checkout" className="btn btn-primary pop w-full">Оформить заказ</Link>
            : <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">Исправьте или удалите отмеченные позиции, чтобы оформить заказ.</p>}
        </aside>
      </div>

      {quote.suggestions.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Вам может понравиться</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quote.suggestions.map((s) => (
              <div key={s.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 pop">
                <div className="w-14"><ProductImage image={s.image} name={s.name} categorySlug={s.category.slug} shape="thumb" /></div>
                <Link href={`/menu/${s.slug}`} className="font-bold leading-tight hover:underline">{s.name}</Link>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <span className="text-sm font-semibold">{s.modifiers.length > 0 && "от "}{sum(s.defaultPrice)}</span>
                  {s.modifiers.some((m) => m.required && m.options.length > 1) || s.modifiers.some((m) => m.required && m.multiple)
                    ? <Link href={`/menu/${s.slug}`} className="btn btn-ghost !px-3 !py-1.5 text-sm">Выбрать</Link>
                    : <QuickAdd productId={s.id} optionIds={s.defaultOptionIds} available={s.available} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
