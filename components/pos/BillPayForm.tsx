"use client";
import { useState } from "react";
import { sum } from "@/lib/format";
import { payQuote, tipByPct, IN_WORK } from "@/lib/table-bill";
import { closeBillAction } from "@/app/pos/tables/actions";

export type PayOrder = { id: string; number: number; total: number; status: string; summary: string };

const TIP_PCTS = [0, 5, 10, 15];

/** Оплата стола: можно выбрать, какие заказы платит гость (раздельный счёт), добавить чаевые и принять оплату. */
export function BillPayForm({ billId, tableId, orders, feePct, canPay, onlyOne }: {
  billId: string; tableId: string; orders: PayOrder[]; feePct: number; canPay: boolean; onlyOne: boolean;
}) {
  const inWork = (o: PayOrder) => (IN_WORK as readonly string[]).includes(o.status);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(orders.filter((o) => !inWork(o)).map((o) => o.id)));
  const [tip, setTip] = useState("");
  const chosen = orders.filter((o) => picked.has(o.id));
  const subtotal = chosen.reduce((s, o) => s + o.total, 0);
  const tipNum = Number(tip.replace(",", ".").replace(/\s/g, "")) || 0;
  const q = payQuote(subtotal, feePct, tipNum);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const disabled = !canPay || chosen.length === 0;
  const btn = "min-h-14 rounded-xl px-4 py-3 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-40";
  const waiting = orders.filter(inWork);

  return (
    <form action={closeBillAction} className="space-y-3">
      <input type="hidden" name="billId" value={billId} /><input type="hidden" name="tableId" value={tableId} /><input type="hidden" name="split" value="1" />
      {chosen.map((o) => <input key={o.id} type="hidden" name="orderId" value={o.id} />)}

      {!onlyOne && (
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-bold">Что оплачивает гость</legend>
          {orders.map((o) => (
            <label key={o.id} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 ${picked.has(o.id) ? "border-green-600 bg-green-50" : "border-neutral-200"} ${inWork(o) ? "opacity-50" : ""}`}>
              <input type="checkbox" className="size-5" checked={picked.has(o.id)} disabled={inWork(o)} onChange={() => toggle(o.id)} />
              <span className="min-w-0 flex-1"><span className="font-semibold">№{o.number}</span> <span className="text-sm text-neutral-600">{o.summary}</span>{inWork(o) && <span className="block text-xs text-amber-800">ещё готовится</span>}</span>
              <span className="whitespace-nowrap font-semibold">{sum(o.total)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {onlyOne && waiting.length > 0 && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Заказ №{waiting[0].number} ещё готовится. Оплатить можно, когда кухня его отдаст.</p>}
      {!onlyOne && waiting.length > 0 && <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Ещё готовятся: {waiting.map((o) => `№${o.number}`).join(", ")}. Их можно оплатить, когда кухня отдаст.</p>}

      <div className="space-y-1 rounded-xl bg-neutral-50 p-3 text-sm">
        <p className="flex justify-between"><span>Заказы{chosen.length > 0 && !onlyOne ? ` (${chosen.length})` : ""}</span><span>{sum(q.subtotal)}</span></p>
        {feePct > 0 && <p className="flex justify-between"><span>Сервисный сбор {feePct}%</span><span>{sum(q.fee)}</span></p>}
        <p className="flex items-baseline justify-between text-2xl font-black"><span>К оплате</span><span>{sum(q.total)}</span></p>
      </div>

      <div className="space-y-2">
        <label htmlFor="tip" className="text-sm font-bold">Чаевые (необязательно)</label>
        <div className="flex flex-wrap items-center gap-2">
          <input id="tip" name="tip" inputMode="numeric" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0" className="min-h-12 w-32 rounded-xl border border-neutral-300 px-3 text-lg" />
          {TIP_PCTS.map((p) => (
            <button key={p} type="button" onClick={() => setTip(p === 0 ? "" : String(tipByPct(q.total, p)))} className="min-h-12 rounded-xl border border-neutral-300 px-3 text-sm font-semibold hover:bg-neutral-50">{p === 0 ? "Без чаевых" : `${p}%`}</button>
          ))}
        </div>
        {q.tip > 0 && <p className="text-sm font-semibold">Гость платит всего: {sum(q.collect)} <span className="font-normal text-neutral-500">(чаевые {sum(q.tip)} не входят в выручку)</span></p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button name="method" value="CASH" disabled={disabled} className={`${btn} bg-green-700 text-white`}>Наличные</button>
        <button name="method" value="CARD" disabled={disabled} className={`${btn} bg-neutral-900 text-white`}>Картой</button>
      </div>
    </form>
  );
}
