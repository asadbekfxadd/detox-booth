"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-store";
import { useMounted } from "@/lib/use-mounted";
import { sum } from "@/lib/format";
import { quoteCartAction, placeTableOrderAction } from "@/app/(site)/actions";
import type { QuotedLine } from "@/services/catalog";

const field = "w-full rounded-xl border border-forest/20 bg-white px-4 py-3 text-sm font-medium text-forest outline-none placeholder:text-forest/45 focus:border-orange";

/** Оформление за столом: без адреса, телефона и оплаты. Заказ уходит на кухню, платят одним счётом в конце. */
export function TableCheckoutForm({ tableNumber }: { tableNumber: number }) {
  const router = useRouter();
  const { lines, clear } = useCart();
  const mounted = useMounted();
  const [view, setView] = useState<QuotedLine[]>([]);
  const [subtotal, setSubtotal] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const sig = JSON.stringify(lines);
  useEffect(() => {
    if (!mounted || lines.length === 0) return;
    let alive = true;
    (async () => {
      const r = await quoteCartAction(lines);
      if (!alive) return;
      if ("quote" in r) { setView(r.quote.lines); setSubtotal(r.quote.subtotal); }
      else setError(r.error);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, sig]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const r = await placeTableOrderAction({ items: lines, name: name || undefined, note: note || undefined });
      if ("error" in r) { setError(r.error); return; }
      clear();
      router.push("/table");
    } catch {
      setError("Не удалось отправить заказ. Проверьте соединение и попробуйте ещё раз.");
    } finally { lock.current = false; setBusy(false); }
  }

  if (!mounted) return <p className="py-16 text-center text-forest/60">Загружаем…</p>;
  if (lines.length === 0)
    return (
      <div className="rounded-2xl bg-white p-10 text-center pop">
        <p className="text-lg font-bold">Корзина пуста</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/menu" className="btn btn-primary pop">В меню</Link>
          <Link href="/table" className="btn btn-ghost pop">Мой счёт</Link>
        </div>
      </div>
    );

  const bad = view.find((l) => l.problem);
  return (
    <form onSubmit={submit} className="mx-auto grid max-w-2xl gap-5">
      <section className="space-y-2 rounded-2xl bg-white p-5 pop">
        <h2 className="font-bold">Ваш заказ</h2>
        <ul className="space-y-1 text-sm">
          {view.map((l) => (
            <li key={`${l.productId}${l.optionIds.join()}`} className="flex justify-between gap-3">
              <span>{l.quantity} × {l.name}{l.optionNames.length > 0 && <span className="text-forest/60"> ({l.optionNames.join(", ")})</span>}</span>
              <span className="whitespace-nowrap">{l.problem ? "—" : sum(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {subtotal != null && <p className="flex justify-between border-t pt-2 text-lg font-bold"><span>Сумма заказа</span><span>{sum(subtotal)}</span></p>}
        <p className="text-xs text-forest/60">Оплата одним счётом в конце: позовите официанта или нажмите «Попросить счёт» на странице «Мой счёт».</p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 pop">
        <h2 className="font-bold">Для кухни</h2>
        <input className={field} aria-label="Имя" placeholder="Как к вам обращаться (необязательно)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" />
        <textarea className={field} aria-label="Комментарий к заказу" rows={2} maxLength={250} placeholder="Комментарий: например, без льда или меньше сахара (необязательно)" value={note} onChange={(e) => setNote(e.target.value)} />
      </section>

      {bad && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{bad.name}: {bad.problem}. <Link href="/cart" className="font-semibold underline">Вернуться в корзину</Link></p>}
      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button disabled={busy || subtotal == null || !!bad} className="btn btn-primary pop w-full text-lg">
        {busy ? "Отправляем…" : `Отправить на кухню, стол №${tableNumber}`}
      </button>
    </form>
  );
}
