"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-store";
import { useMounted } from "@/lib/use-mounted";
import { sum } from "@/lib/format";
import { checkoutQuoteAction, placeOrderAction, quoteCartAction } from "@/app/(site)/actions";
import type { WebQuote } from "@/services/web-orders";
import type { QuotedLine } from "@/services/catalog";

const field = "w-full rounded-xl border border-forest/20 bg-white px-4 py-3 text-sm font-medium text-forest outline-none placeholder:text-forest/45 focus:border-orange";
const LS = "detox-customer";

export function CheckoutForm({ locationName, locationId }: { locationName: string; locationId: string }) {
  const router = useRouter();
  const { lines, clear } = useCart();
  const mounted = useMounted();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [referrer, setReferrer] = useState("");
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [address, setAddress] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD">("CASH");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<string | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [quote, setQuote] = useState<WebQuote | null>(null);
  const [view, setView] = useState<QuotedLine[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  // имя и телефон из прошлого заказа (необязательно); читаем после гидратации, не в теле эффекта
  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      try { const s = JSON.parse(localStorage.getItem(LS) ?? "null"); if (s) { setName(s.name ?? ""); setPhone(s.phone ?? ""); } } catch { /* необязательно */ }
    });
    return () => { alive = false; };
  }, []);

  const sig = JSON.stringify([lines, promo, fulfillment]);
  useEffect(() => {
    if (!mounted || lines.length === 0) return;
    let alive = true;
    (async () => {
      const [c, q] = await Promise.all([quoteCartAction(lines), checkoutQuoteAction({ items: lines, promoCode: promo, fulfillment })]);
      if (!alive) return;
      if ("quote" in c) setView(c.quote.lines);
      if ("error" in q) { setProblem(q.error); setQuote(null); } else { setProblem(null); setQuote(q.quote); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, sig, locationId]);

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) { setPromo(null); setPromoMsg(null); return; }
    const r = await checkoutQuoteAction({ items: lines, promoCode: code, fulfillment });
    if ("error" in r) { setPromoMsg({ ok: false, text: r.error }); return; }
    setPromo(code); setPromoMsg({ ok: true, text: `Промокод применён: −${sum(r.quote.discount)}` });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const r = await placeOrderAction({ items: lines, promoCode: promo, fulfillment, name, phone, address, method, referrerPhone: referrer || undefined });
      if ("error" in r) { setError(r.error); return; }
      try { localStorage.setItem(LS, JSON.stringify({ name, phone })); } catch { /* необязательно */ }
      clear();
      router.push(`/order/${r.orderId}`);
    } catch {
      setError("Не удалось оформить заказ. Проверьте соединение и попробуйте ещё раз.");
    } finally { lock.current = false; setBusy(false); }
  }

  if (!mounted) return <p className="py-16 text-center text-forest/60">Загружаем…</p>;
  if (lines.length === 0)
    return (
      <div className="rounded-2xl bg-white p-10 text-center pop">
        <p className="text-lg font-bold">Корзина пуста</p>
        <Link href="/menu" className="btn btn-primary pop mt-4">В меню</Link>
      </div>
    );

  const bad = view.find((l) => l.problem);
  const radio = (on: boolean) => `flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${on ? "border-forest bg-forest font-bold text-white" : "border-forest/20 bg-white"}`;
  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="space-y-3 rounded-2xl bg-white p-5 pop">
          <h2 className="font-bold">Ваши данные</h2>
          <input className={field} placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={80} />
          <input className={field} placeholder="Телефон, например +998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" required />
          <input className={field} placeholder="Телефон друга, который вас пригласил (необязательно)" value={referrer} onChange={(e) => setReferrer(e.target.value)} inputMode="tel" />
          <p className="text-xs text-forest/60">Если вы у нас впервые и вас пригласил друг, укажите его номер — бонус получите оба после вашего первого заказа.</p>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 pop">
          <h2 className="font-bold">Как получить заказ</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={radio(fulfillment === "PICKUP")}><input type="radio" name="f" checked={fulfillment === "PICKUP"} onChange={() => setFulfillment("PICKUP")} />Самовывоз</label>
            <label className={radio(fulfillment === "DELIVERY")}><input type="radio" name="f" checked={fulfillment === "DELIVERY"} onChange={() => setFulfillment("DELIVERY")} />Доставка</label>
          </div>
          <p className="text-sm text-forest/60">Точка: <b>{locationName}</b>{fulfillment === "PICKUP" ? " — заберёте заказ здесь." : " — заказ отправим отсюда."} Сменить точку можно в шапке сайта.</p>
          {fulfillment === "DELIVERY" && <textarea className={field} rows={2} placeholder="Адрес доставки: улица, дом, ориентир" value={address} onChange={(e) => setAddress(e.target.value)} required minLength={6} maxLength={200} />}
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 pop">
          <h2 className="font-bold">Оплата</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={radio(method === "CASH")}><input type="radio" name="m" checked={method === "CASH"} onChange={() => setMethod("CASH")} />Наличными при получении</label>
            <label className={radio(method === "CARD")}><input type="radio" name="m" checked={method === "CARD"} onChange={() => setMethod("CARD")} />Картой при получении</label>
          </div>
          <p className="text-xs text-forest/60">Оплата происходит при получении заказа.</p>
        </section>
      </div>

      <aside className="h-fit space-y-3 rounded-2xl bg-white p-5 pop lg:sticky lg:top-24">
        <h2 className="text-lg font-bold">Ваш заказ</h2>
        <ul className="space-y-1 text-sm">
          {view.map((l) => (
            <li key={`${l.productId}${l.optionIds.join()}`} className="flex justify-between gap-3">
              <span>{l.quantity} × {l.name}{l.optionNames.length > 0 && <span className="text-forest/60"> ({l.optionNames.join(", ")})</span>}</span>
              <span className="whitespace-nowrap">{l.problem ? "—" : sum(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t pt-3">
          <input className={`${field} py-2`} placeholder="Промокод" value={promoInput} onChange={(e) => { setPromoInput(e.target.value); if (promo) { setPromo(null); setPromoMsg(null); } }} />
          <button type="button" onClick={applyPromo} className="btn btn-ghost !px-4 text-sm">Применить</button>
        </div>
        {promoMsg && <p className={`text-xs ${promoMsg.ok ? "text-leaf" : "text-red-600"}`}>{promoMsg.text}</p>}
        {quote && (
          <div className="space-y-1 border-t pt-3 text-sm">
            <p className="flex justify-between"><span>Сумма</span><span>{sum(quote.subtotal)}</span></p>
            {quote.discount > 0 && <p className="flex justify-between text-leaf"><span>Скидка</span><span>−{sum(quote.discount)}</span></p>}
            {fulfillment === "DELIVERY" && <p className="flex justify-between"><span>Доставка</span><span>{sum(quote.deliveryFee)}</span></p>}
            <p className="flex justify-between border-t pt-2 text-lg font-bold"><span>Итого</span><span>{sum(quote.total)}</span></p>
            {quote.points > 0 && <p className="text-xs text-forest/60">+{quote.points} баллов после получения заказа</p>}
          </div>
        )}
        {bad && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{bad.name}: {bad.problem}. <Link href="/cart" className="font-semibold underline">Вернуться в корзину</Link></p>}
        {!bad && problem && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{problem}</p>}
        {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button disabled={busy || !quote || !!bad} className="btn btn-primary pop w-full">
          {busy ? "Оформляем…" : quote ? `Заказать · ${sum(quote.total)}` : "Заказать"}
        </button>
      </aside>
    </form>
  );
}
