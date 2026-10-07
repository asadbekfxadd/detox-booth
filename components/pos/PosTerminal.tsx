"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import {
  createOrderAction, quoteAction, searchCustomersAction, createCustomerAction, recentOrdersAction, refundOrderAction, logoutAction,
} from "@/app/pos/actions";
import type { PosCatalog, CatalogProduct, CustomerLite, RecentOrder, OrderResult } from "@/services/pos";

type Line = { key: string; product: CatalogProduct; quantity: number; optionIds: string[] };
type Method = "CASH" | "CARD" | "ONLINE";
type Applied = { kind: "promo"; code: string } | { kind: "manual"; type: "PERCENT" | "FIXED"; value: number } | null;
type Receipt = Extract<OrderResult, { ok: true }>;

const GENERIC_ERROR = "Что-то пошло не так. Попробуйте ещё раз.";
const ZERO_QUOTE = { discount: 0, pointsAmt: 0, maxRedeem: 0 };
const METHODS: [Method, string][] = [["CASH", "Наличные"], ["CARD", "Карта"], ["ONLINE", "Онлайн / перевод"]];
const METHOD_LABEL: Record<string, string> = { CASH: "Наличные", CARD: "Карта", ONLINE: "Онлайн" };
const STATUS_LABEL: Record<string, string> = { COMPLETED: "Оплачен", CANCELLED: "Возврат", CONFIRMED: "В работе" };

const optionsOf = (p: CatalogProduct, ids: string[]) => p.modifiers.flatMap((m) => m.options).filter((o) => ids.includes(o.id));
const unitPrice = (p: CatalogProduct, ids: string[]) => p.price + optionsOf(p, ids).reduce((a, o) => a + o.priceDelta, 0);
const lineKey = (p: CatalogProduct, ids: string[]) => `${p.id}|${[...ids].sort().join(",")}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });

export function PosTerminal({ catalog, locationName, cashier, canRefund, adminHref }: {
  catalog: PosCatalog; locationName: string; cashier: string; canRefund: boolean; adminHref: string | null;
}) {
  const router = useRouter();
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [dialog, setDialog] = useState<CatalogProduct | null>(null);
  const [notice, setNotice] = useState("");

  // клиент
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [cq, setCq] = useState("");
  const [foundRaw, setFound] = useState<CustomerLite[]>([]);
  const [newCust, setNewCust] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [custErr, setCustErr] = useState("");

  // скидка
  const [dMode, setDMode] = useState<"promo" | "manual">("promo");
  const [promo, setPromo] = useState("");
  const [mType, setMType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [mValue, setMValue] = useState("");
  const [applied, setApplied] = useState<Applied>(null);
  const [quoted, setQuoted] = useState(ZERO_QUOTE);
  const [discErr, setDiscErr] = useState("");
  const [redeem, setRedeem] = useState("");

  // оплата
  const [method, setMethod] = useState<Method>("CASH");
  const [tendered, setTendered] = useState("");
  const [paying, setPaying] = useState(false);
  const payLock = useRef(false); // защита от двойного клика до перерисовки
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // заказы смены
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [ordersErr, setOrdersErr] = useState("");

  const items = useMemo(() => cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, optionIds: l.optionIds })), [cart]);
  const itemsKey = JSON.stringify(items);
  const subtotal = cart.reduce((a, l) => a + unitPrice(l.product, l.optionIds) * l.quantity, 0);
  // сервер считает скидку и баллы только при активной корзине со скидкой/клиентом; иначе нули
  const quoteActive = cart.length > 0 && (!!applied || !!customer);
  const { discount, pointsAmt, maxRedeem } = quoteActive ? quoted : ZERO_QUOTE;
  const found = cq.trim().length >= 2 ? foundRaw : [];
  const total = Math.max(0, subtotal - discount);
  const redeemNum = customer ? Math.max(0, Math.floor(Number(redeem) || 0)) : 0;
  const tenderedNum = tendered === "" ? null : Number(tendered);
  const change = method === "CASH" && tenderedNum != null && tenderedNum >= total ? tenderedNum - total : 0;
  const tooLittle = method === "CASH" && tenderedNum != null && tenderedNum < total;

  const visible = catalog.products.filter((p) => (cat === "all" || p.categoryId === cat) && p.name.toLowerCase().includes(q.trim().toLowerCase()));

  // серверный пересчёт скидки и баллов при любом изменении корзины
  useEffect(() => {
    if (!quoteActive) return;
    let cancelled = false;
    quoteAction({
      items, customerId: customer?.id ?? null, redeemPoints: redeemNum,
      promoCode: applied?.kind === "promo" ? applied.code : null,
      manualDiscount: applied?.kind === "manual" ? { type: applied.type, value: applied.value } : null,
    }).then((r) => {
      if (cancelled) return;
      if (r.ok) { setQuoted({ discount: r.discount, pointsAmt: r.pointsAmount, maxRedeem: r.maxRedeemPoints }); setDiscErr(""); }
      else { setDiscErr(r.error); setApplied(null); setRedeem(""); setQuoted(ZERO_QUOTE); }
    }).catch(() => { if (!cancelled) { setDiscErr(GENERIC_ERROR); setApplied(null); setRedeem(""); setQuoted(ZERO_QUOTE); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, itemsKey, customer?.id, redeemNum]);

  // поиск клиента
  useEffect(() => {
    if (cq.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchCustomersAction(cq).then((r) => { if (!cancelled && r.ok) setFound(r.customers); }).catch(() => {});
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [cq]);

  function qtyInCart(p: CatalogProduct) { return cart.filter((l) => l.product.id === p.id).reduce((a, l) => a + l.quantity, 0); }

  function addToCart(p: CatalogProduct, optionIds: string[], quantity = 1) {
    if (p.portions != null && qtyInCart(p) + quantity > p.portions) { setNotice(`«${p.name}»: доступно только ${p.portions} порц.`); return false; }
    setNotice(""); setError("");
    const key = lineKey(p, optionIds);
    setCart((c) => c.some((l) => l.key === key)
      ? c.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l))
      : [...c, { key, product: p, quantity, optionIds }]);
    return true;
  }
  function changeQty(key: string, delta: number) {
    const line = cart.find((l) => l.key === key);
    if (!line) return;
    if (delta > 0 && line.product.portions != null && qtyInCart(line.product) + delta > line.product.portions) { setNotice(`«${line.product.name}»: доступно только ${line.product.portions} порц.`); return; }
    setNotice("");
    setCart((c) => c.flatMap((l) => (l.key !== key ? [l] : l.quantity + delta <= 0 ? [] : [{ ...l, quantity: l.quantity + delta }])));
  }
  function tapProduct(p: CatalogProduct) {
    if (!p.isAvailable || p.portions === 0) return;
    if (p.modifiers.length) setDialog(p); else addToCart(p, []);
  }
  function resetOrder() {
    setCart([]); setCustomer(null); setCq(""); setFound([]); setApplied(null); setQuoted(ZERO_QUOTE); setRedeem(""); setPromo(""); setMValue("");
    setDiscErr(""); setTendered(""); setMethod("CASH"); setError(""); setNotice("");
  }

  function applyDiscount() {
    setDiscErr("");
    if (dMode === "promo") {
      if (!promo.trim()) { setDiscErr("Введите промокод"); return; }
      setApplied({ kind: "promo", code: promo.trim() });
    } else {
      const v = Number(mValue);
      if (!mValue || !(v > 0)) { setDiscErr("Введите размер скидки"); return; }
      setApplied({ kind: "manual", type: mType, value: v });
    }
  }

  async function addCustomer() {
    setCustErr("");
    try {
      const r = await createCustomerAction({ name: ncName, phone: ncPhone });
      if (!r.ok) { setCustErr(r.error); return; }
      setCustomer(r.customer); setNewCust(false); setNcName(""); setNcPhone(""); setCq("");
    } catch { setCustErr(GENERIC_ERROR); }
  }

  async function pay() {
    if (payLock.current || paying || cart.length === 0) return;
    payLock.current = true;
    setPaying(true); setError("");
    try {
      const r = await createOrderAction({
        items, customerId: customer?.id ?? null, redeemPoints: redeemNum,
        promoCode: applied?.kind === "promo" ? applied.code : null,
        manualDiscount: applied?.kind === "manual" ? { type: applied.type, value: applied.value } : null,
        method, tendered: method === "CASH" && tenderedNum != null ? tenderedNum : null,
      });
      if (!r.ok) { setError(r.error); router.refresh(); return; }
      setReceipt(r); resetOrder(); router.refresh();
      if (ordersOpen) loadOrders();
    } catch { setError(GENERIC_ERROR); }
    finally { payLock.current = false; setPaying(false); }
  }

  async function loadOrders() {
    setOrdersErr("");
    try { const r = await recentOrdersAction(); if (r.ok) setOrders(r.orders); else setOrdersErr(r.error); }
    catch { setOrdersErr(GENERIC_ERROR); }
  }

  return (
    <div className="flex h-screen flex-col bg-[#f7f3ea] text-neutral-900">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2">
        <span className="text-lg font-bold text-green-800">Vitamin B</span>
        <span className="text-sm text-neutral-600">{locationName} · {cashier}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <button onClick={() => { setOrdersOpen(true); loadOrders(); }} className="rounded-lg border border-neutral-200 px-3 py-1.5 hover:bg-neutral-50">Заказы смены</button>
          <Link href="/pos/shift" className="rounded-lg border border-neutral-200 px-3 py-1.5 hover:bg-neutral-50">Смена</Link>
          {adminHref && <Link href={adminHref} className="rounded-lg border border-neutral-200 px-3 py-1.5 hover:bg-neutral-50">Админка</Link>}
          <form action={logoutAction}><button className="rounded-lg border border-neutral-200 px-3 py-1.5 hover:bg-neutral-50">Выйти</button></form>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Каталог */}
        <section className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию" className="min-w-48 flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-2 outline-none focus:border-green-600" />
            <div className="flex flex-wrap gap-1">
              {[{ id: "all", name: "Все" }, ...catalog.categories].map((c) => (
                <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-full px-4 py-2 text-sm ${cat === c.id ? "bg-green-700 text-white" : "bg-white hover:bg-neutral-50"}`}>{c.name}</button>
              ))}
            </div>
          </div>
          {notice && <p className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">{notice}</p>}
          <div className="grid flex-1 content-start gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.length === 0 && <p className="col-span-full p-8 text-center text-neutral-500">Ничего не найдено</p>}
            {visible.map((p) => {
              const out = !p.isAvailable || p.portions === 0;
              return (
                <button key={p.id} disabled={out} onClick={() => tapProduct(p)}
                  className={`flex min-h-28 flex-col justify-between rounded-2xl p-4 text-left shadow-sm transition ${out ? "cursor-not-allowed bg-neutral-100 text-neutral-400" : "bg-white hover:shadow-md active:scale-[0.98]"}`}>
                  <span className="font-semibold leading-snug">{p.name}</span>
                  <span className="mt-2 flex items-end justify-between">
                    <span className="text-lg font-bold">{money(p.price)}</span>
                    {out ? <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs">{p.isAvailable ? "Нет в наличии" : "Недоступно"}</span>
                      : p.portions != null && p.portions <= 5 ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">осталось {p.portions}</span>
                      : p.modifiers.length ? <span className="text-xs text-neutral-500">опции</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Корзина */}
        <aside className="flex max-h-[60vh] w-full flex-col border-t border-neutral-200 bg-white lg:max-h-none lg:w-[400px] lg:border-l lg:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <h2 className="mb-2 font-bold">Заказ</h2>
            {cart.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">Выберите товары слева</p>}
            {cart.map((l) => (
              <div key={l.key} className="flex gap-2 border-b border-neutral-100 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{l.product.name}</p>
                  {l.optionIds.length > 0 && <p className="text-xs text-neutral-500">{optionsOf(l.product, l.optionIds).map((o) => o.name).join(", ")}</p>}
                  <p className="text-xs text-neutral-500">{money(unitPrice(l.product, l.optionIds))} × {l.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(l.key, -1)} className="h-8 w-8 rounded-lg border border-neutral-200 hover:bg-neutral-50" aria-label="Меньше">−</button>
                  <span className="w-6 text-center">{l.quantity}</span>
                  <button onClick={() => changeQty(l.key, 1)} className="h-8 w-8 rounded-lg border border-neutral-200 hover:bg-neutral-50" aria-label="Больше">+</button>
                </div>
                <p className="w-24 text-right font-semibold">{money(unitPrice(l.product, l.optionIds) * l.quantity)}</p>
              </div>
            ))}

            {/* Клиент */}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">Клиент</p>
              {customer ? (
                <div className="flex items-center justify-between rounded-xl bg-lime-50 px-3 py-2 text-sm">
                  <span><b>{customer.name}</b> · {customer.phone}<br /><span className="text-neutral-600">Баллов: {customer.points}</span></span>
                  <button onClick={() => { setCustomer(null); setRedeem(""); }} className="text-neutral-500 hover:text-red-700" aria-label="Убрать клиента">×</button>
                </div>
              ) : (
                <>
                  <input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Телефон или имя" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-green-600" />
                  {found.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-neutral-200">
                      {found.map((c) => (
                        <button key={c.id} onClick={() => { setCustomer(c); setCq(""); setFound([]); }} className="block w-full border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-neutral-50">
                          <b>{c.name}</b> · {c.phone} <span className="text-neutral-500">· {c.points} б.</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!newCust ? <button onClick={() => setNewCust(true)} className="text-sm text-green-800 underline">+ Новый клиент</button> : (
                    <div className="space-y-2 rounded-xl border border-neutral-200 p-3">
                      <input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Имя" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
                      <input value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="+998 90 123 45 67" inputMode="tel" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
                      {custErr && <p className="text-sm text-red-700">{custErr}</p>}
                      <div className="flex gap-2">
                        <button onClick={addCustomer} className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-semibold text-white">Добавить</button>
                        <button onClick={() => { setNewCust(false); setCustErr(""); }} className="rounded-lg border border-neutral-200 px-4 py-1.5 text-sm">Отмена</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {customer && customer.points > 0 && (
              <div className="mt-3 space-y-1 rounded-xl border border-neutral-200 p-3 text-sm">
                <p className="font-semibold">Оплатить баллами</p>
                <div className="flex gap-2">
                  <input value={redeem} onChange={(e) => setRedeem(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={`до ${maxRedeem} б.`} className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
                  <button onClick={() => setRedeem(String(maxRedeem))} disabled={maxRedeem <= 0} className="rounded-lg border border-neutral-200 px-3 hover:bg-neutral-50 disabled:opacity-50">Макс.</button>
                </div>
                {pointsAmt > 0 && <p className="text-green-800">Баллами: −{money(pointsAmt)}</p>}
              </div>
            )}

            {/* Скидка */}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">Скидка</p>
              {applied ? (
                <div className="flex items-center justify-between rounded-xl bg-lime-50 px-3 py-2 text-sm">
                  <span>{applied.kind === "promo" ? `Промокод ${applied.code}` : `Ручная: ${applied.value}${applied.type === "PERCENT" ? "%" : " UZS"}`} · <b>−{money(Math.max(0, discount - pointsAmt))}</b></span>
                  <button onClick={() => { setApplied(null); setQuoted(ZERO_QUOTE); }} className="text-neutral-500 hover:text-red-700" aria-label="Убрать скидку">×</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-1 text-xs">
                    {(["promo", "manual"] as const).map((m) => (
                      <button key={m} onClick={() => { setDMode(m); setDiscErr(""); }} className={`rounded-full px-3 py-1 ${dMode === m ? "bg-green-700 text-white" : "bg-neutral-100"}`}>{m === "promo" ? "Промокод" : "Вручную"}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {dMode === "promo" ? (
                      <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Код" className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm uppercase" />
                    ) : (
                      <>
                        <select value={mType} onChange={(e) => setMType(e.target.value as "PERCENT" | "FIXED")} className="rounded-lg border border-neutral-200 bg-white px-2 text-sm"><option value="PERCENT">%</option><option value="FIXED">UZS</option></select>
                        <input value={mValue} onChange={(e) => setMValue(e.target.value)} type="number" min="0" step="any" placeholder="Размер" className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
                      </>
                    )}
                    <button onClick={applyDiscount} disabled={cart.length === 0} className="rounded-lg border border-neutral-200 px-3 text-sm hover:bg-neutral-50 disabled:opacity-50">Применить</button>
                  </div>
                </>
              )}
              {discErr && <p className="text-sm text-red-700">{discErr}</p>}
            </div>
          </div>

          {/* Итог и оплата */}
          <div className="space-y-3 border-t border-neutral-200 p-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-neutral-600"><span>Сумма</span><span>{money(subtotal)}</span></div>
              {discount - pointsAmt > 0 && <div className="flex justify-between text-green-800"><span>Скидка</span><span>−{money(discount - pointsAmt)}</span></div>}
              {pointsAmt > 0 && <div className="flex justify-between text-green-800"><span>Баллы ({redeemNum})</span><span>−{money(pointsAmt)}</span></div>}
              <div className="flex justify-between text-xl font-bold"><span>Итого</span><span>{money(total)}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {METHODS.map(([m, l]) => (
                <button key={m} onClick={() => setMethod(m)} className={`rounded-lg px-1 py-2 text-xs sm:text-sm ${method === m ? "bg-green-700 font-semibold text-white" : "border border-neutral-200 hover:bg-neutral-50"}`}>{l}</button>
              ))}
            </div>
            {method === "CASH" && (
              <div className="space-y-1">
                <div className="flex gap-2">
                  <input value={tendered} onChange={(e) => setTendered(e.target.value)} type="number" min="0" step="any" placeholder="Получено от клиента" className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
                  <button onClick={() => setTendered(String(total))} className="rounded-lg border border-neutral-200 px-3 text-sm hover:bg-neutral-50">Без сдачи</button>
                </div>
                {tooLittle ? <p className="text-sm text-red-700">Получено меньше суммы заказа</p> : tenderedNum != null && <p className="text-sm text-neutral-600">Сдача: <b>{money(change)}</b></p>}
              </div>
            )}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button onClick={resetOrder} disabled={cart.length === 0 || paying} className="rounded-xl border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50 disabled:opacity-50">Отменить заказ</button>
              <button onClick={pay} disabled={cart.length === 0 || paying || tooLittle} className="flex-1 rounded-xl bg-green-700 py-3 text-lg font-semibold text-white hover:bg-green-800 disabled:opacity-50">{paying ? "Проводим…" : `Оплатить ${money(total)}`}</button>
            </div>
          </div>
        </aside>
      </div>

      {dialog && <ModifierDialog product={dialog} onClose={() => setDialog(null)} onAdd={(ids, qty) => { if (addToCart(dialog, ids, qty)) setDialog(null); }} />}

      {receipt && (
        <Overlay onClose={() => setReceipt(null)}>
          <div className="space-y-3 text-center">
            <p className="text-4xl">✅</p>
            <h2 className="text-2xl font-bold">Заказ №{receipt.number} оплачен</h2>
            <p className="text-3xl font-bold">{money(receipt.total)}</p>
            <p className="text-neutral-600">{METHOD_LABEL[receipt.method]}{receipt.discount > 0 && ` · скидка ${money(receipt.discount)}`}</p>
            {receipt.method === "CASH" && receipt.change > 0 && <p className="rounded-xl bg-amber-100 py-2 text-xl font-bold text-amber-900">Сдача: {money(receipt.change)}</p>}
            {receipt.pointsSpent > 0 && <p className="text-sm text-neutral-600">Списано баллов: {receipt.pointsSpent}</p>}
            {receipt.pointsEarned > 0 && <p className="text-sm text-green-800">Клиенту начислено баллов: {receipt.pointsEarned}</p>}
            <button onClick={() => setReceipt(null)} className="w-full rounded-xl bg-green-700 py-3 text-lg font-semibold text-white hover:bg-green-800">Новый заказ</button>
          </div>
        </Overlay>
      )}

      {ordersOpen && (
        <Overlay onClose={() => setOrdersOpen(false)} wide>
          <h2 className="mb-3 text-xl font-bold">Заказы смены</h2>
          {ordersErr && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ordersErr}</p>}
          {orders.length === 0 && !ordersErr && <p className="py-6 text-center text-neutral-500">Пока нет заказов</p>}
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {orders.map((o) => <OrderRow key={o.id} o={o} onRefunded={loadOrders} />)}
          </div>
          {canRefund === false && <p className="mt-3 text-xs text-neutral-500">Возврат оформляет менеджер.</p>}
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-xl ${wide ? "max-w-xl" : "max-w-sm"}`} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModifierDialog({ product, onClose, onAdd }: { product: CatalogProduct; onClose: () => void; onAdd: (ids: string[], qty: number) => void }) {
  const [sel, setSel] = useState<string[]>(() => product.modifiers.filter((m) => m.required && !m.multiple && m.options[0]).map((m) => m.options[0].id));
  const [qty, setQty] = useState(1);
  const toggle = (m: CatalogProduct["modifiers"][number], id: string) =>
    setSel((s) => m.multiple ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [...s.filter((x) => !m.options.some((o) => o.id === x)), id]);
  const missing = product.modifiers.find((m) => m.required && !m.options.some((o) => sel.includes(o.id)));
  const unit = unitPrice(product, sel);
  return (
    <Overlay onClose={onClose}>
      <h2 className="text-xl font-bold">{product.name}</h2>
      <div className="mt-3 space-y-4">
        {product.modifiers.map((m) => (
          <div key={m.id}>
            <p className="mb-1 text-sm font-semibold">{m.name}{m.required ? " *" : ""}<span className="ml-2 font-normal text-neutral-500">{m.multiple ? "можно несколько" : "один вариант"}</span></p>
            <div className="flex flex-wrap gap-2">
              {m.options.map((o) => {
                const on = sel.includes(o.id);
                return (
                  <button key={o.id} onClick={() => toggle(m, o.id)} className={`rounded-xl border px-3 py-2 text-sm ${on ? "border-green-700 bg-green-700 text-white" : "border-neutral-200 hover:bg-neutral-50"}`}>
                    {o.name}{o.priceDelta !== 0 && <span className="ml-1 opacity-80">{o.priceDelta > 0 ? "+" : "−"}{money(Math.abs(o.priceDelta))}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setQty((n) => Math.max(1, n - 1))} className="h-9 w-9 rounded-lg border border-neutral-200">−</button>
          <span className="w-8 text-center text-lg">{qty}</span>
          <button onClick={() => setQty((n) => Math.min(50, n + 1))} className="h-9 w-9 rounded-lg border border-neutral-200">+</button>
        </div>
        <p className="text-xl font-bold">{money(unit * qty)}</p>
      </div>
      {missing && <p className="mt-2 text-sm text-amber-800">Выберите «{missing.name}»</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="rounded-xl border border-neutral-200 px-5 py-3">Отмена</button>
        <button disabled={!!missing} onClick={() => onAdd(sel, qty)} className="flex-1 rounded-xl bg-green-700 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50">Добавить в заказ</button>
      </div>
    </Overlay>
  );
}

function OrderRow({ o, onRefunded }: { o: RecentOrder; onRefunded: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function refund() {
    setBusy(true); setErr("");
    try {
      const r = await refundOrderAction({ orderId: o.id, reason });
      if (!r.ok) { setErr(r.error); return; }
      setOpen(false); onRefunded();
    } catch { setErr(GENERIC_ERROR); }
    finally { setBusy(false); }
  }
  return (
    <div className="rounded-xl border border-neutral-200 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">№{o.number} · {hhmm(o.createdAt)}</span>
        <span className={`rounded px-2 py-0.5 text-xs ${o.status === "COMPLETED" ? "bg-lime-100 text-green-900" : o.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
      </div>
      <p className="mt-1 text-neutral-600">{o.summary}</p>
      <div className="mt-1 flex items-center justify-between">
        <span>{money(o.total)}{o.method && ` · ${METHOD_LABEL[o.method]}`}</span>
        {o.refundable && !open && <button onClick={() => setOpen(true)} className="text-red-700 underline">Возврат</button>}
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg bg-neutral-50 p-2">
          <p className="text-xs text-neutral-500">Ингредиенты на склад не возвращаются (продукт приготовлен). Баллы клиента будут списаны обратно.</p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина возврата" className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
          {err && <p className="text-red-700">{err}</p>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={refund} className="rounded-lg bg-red-700 px-4 py-1.5 font-semibold text-white disabled:opacity-60">{busy ? "…" : "Вернуть деньги"}</button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-neutral-200 px-4 py-1.5">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
