"use client";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { money } from "@/lib/format";

const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));
const axis = { fontSize: 12, fill: "#737373" };

export function FinanceChart({ data }: { data: { label: string; revenue: number; profit: number; expenses: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axis} /><YAxis tick={axis} tickFormatter={short} width={44} />
          <Tooltip formatter={(v) => money(Number(v))} /><Legend />
          <Area type="monotone" dataKey="revenue" name="Выручка" stroke="#15803d" fill="#bbf7d0" />
          <Area type="monotone" dataKey="profit" name="Валовая прибыль" stroke="#65a30d" fill="#d9f99d" />
          <Area type="monotone" dataKey="expenses" name="Расходы" stroke="#dc2626" fill="#fecaca" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CountBars({ data, xKey, name = "Заказов" }: { data: Record<string, any>[]; xKey: string; name?: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={axis} interval="preserveStartEnd" /><YAxis tick={axis} allowDecimals={false} width={32} />
          <Tooltip /><Bar dataKey="orders" name={name} fill="#84cc16" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
