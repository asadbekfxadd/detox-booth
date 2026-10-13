"use client";
import { useEffect, useSyncExternalStore } from "react";

const ON_KEY = "kitchen.autoprint";
const DONE_KEY = "kitchen.printed";
const EVT = "kitchen-autoprint";

function read(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* приватный режим: автопечать просто не запомнится */ } }
const printedSet = () => { try { return new Set<string>(JSON.parse(read(DONE_KEY) ?? "[]")); } catch { return new Set<string>(); } };
const remember = (keys: string[]) => write(DONE_KEY, JSON.stringify([...printedSet(), ...keys].slice(-300)));
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };

/** Печатает бегунок на каждый новый заказ, пока кухонный экран открыт. Нужна «тихая» печать браузера (см. README), иначе на каждый бегунок будет диалог. */
export function AutoPrint({ orders, station }: { orders: string[]; station: string | null }) {
  const on = useSyncExternalStore(subscribe, () => read(ON_KEY) === "1", () => false);
  const keyOf = (id: string) => `${id}:${station ?? "all"}`;

  useEffect(() => {
    if (!on) return;
    const done = printedSet();
    const todo = orders.filter((id) => !done.has(keyOf(id)));
    if (todo.length === 0) return;
    remember(todo.map(keyOf));
    const timers = todo.map((id, i) => setTimeout(() => {
      const f = document.createElement("iframe");
      f.setAttribute("aria-hidden", "true");
      f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
      f.src = `/print/kitchen/${id}?auto=1${station ? `&station=${encodeURIComponent(station)}` : ""}`;
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 60000);
    }, i * 3000));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, orders.join("|"), station]);

  function toggle() {
    if (!on) remember(orders.map(keyOf)); // то, что уже висит на экране, заново не печатаем
    write(ON_KEY, on ? "0" : "1");
    window.dispatchEvent(new Event(EVT));
  }

  return (
    <button type="button" aria-pressed={on} onClick={toggle} title="Печатать бегунок на каждый новый заказ"
      className="min-h-11 rounded-full border border-neutral-600 px-4 text-sm font-semibold hover:bg-neutral-800">
      {on ? "🖨 Автопечать включена" : "🖨 Включить автопечать"}
    </button>
  );
}
