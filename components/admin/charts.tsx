"use client";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { money } from "@/lib/format";

const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));
const axis = { fontSize: 12, fill: "#737373" };

export function RevenueProfitChart({ data }: { data: { label: string; revenue: number; profit: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} /><YAxis tick={axis} tickFormatter={short} width={44} />
          <Tooltip formatter={(v) => money(Number(v))} />
          <Area type="monotone" dataKey="revenue" name="Выручка" stroke="#15803d" fill="#bbf7d0" />
          <Area type="monotone" dataKey="profit" name="Прибыль" stroke="#65a30d" fill="#d9f99d" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersChart({ data }: { data: { label: string; orders: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} /><YAxis tick={axis} allowDecimals={false} width={32} />
          <Tooltip /><Bar dataKey="orders" name="Заказы" fill="#84cc16" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBarChart({ data, dataKey, nameKey }: { data: Record<string, any>[]; dataKey: string; nameKey: string }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={axis} tickFormatter={short} />
          <YAxis type="category" dataKey={nameKey} tick={axis} width={130} />
          <Tooltip formatter={(v) => money(Number(v))} />
          <Bar dataKey={dataKey} fill="#16a34a" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
