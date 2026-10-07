"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { myOrdersAction } from "@/app/(site)/actions";
import type { OrderBrief } from "@/services/web-orders";
import { readOrderIds } from "@/lib/order-history";
import { dateTimeStr, sum } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/order-status";
import { RepeatOrder } from "./RepeatOrder";

export function OrdersList() {
  const [orders, setOrders] = useState<OrderBrief[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = readOrderIds();
      if (ids.length === 0) { if (alive) setOrders([]); return; }
      const r = await myOrdersAction(ids);
      if (!alive) return;
      if ("error" in r) setError(r.error); else setOrders(r.orders);
    })();
    return () => { alive = false; };
  }, []);

  if (error) return <p role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</p>;
  if (orders === null) return <p className="py-16 text-center text-forest/60">Загружаем…</p>;
  if (orders.length === 0)
    return (
      <div className="pop rounded-2xl bg-white p-10 text-center">
        <p className="text-lg font-bold">Заказов пока нет</p>
        <p className="mt-1 text-sm text-forest/70">Здесь появятся заказы, сделанные с этого устройства.</p>
        <Link href="/menu" className="btn btn-primary pop mt-4">В меню</Link>
      </div>
    );
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id} className="pop flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4">
          <div className="min-w-0">
            <Link href={`/order/${o.id}`} className="font-bold hover:underline">Заказ №{o.number}</Link>
            <p className="text-sm text-forest/70">{dateTimeStr(o.createdAt)} · {o.location} · {STATUS_LABEL[o.status]}</p>
            <p className="truncate text-sm">{o.summary}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold">{sum(o.total)}</span>
            <RepeatOrder lines={o.repeat} className="btn btn-ghost !px-4 !py-2 text-sm" label="Повторить" />
          </div>
        </li>
      ))}
    </ul>
  );
}
