"use client";
import { useEffect, useRef, useState } from "react";

/** Короткий сигнал при появлении нового заказа. Звук включается кнопкой (браузер не даёт играть без нажатия). */
export function NewOrderSound({ count }: { count: number }) {
  const [on, setOn] = useState(false);
  const prev = useRef(count);
  const ctx = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (on && count > prev.current && ctx.current) {
      const c = ctx.current, o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.35);
    }
    prev.current = count;
  }, [count, on]);

  return (
    <button type="button" aria-pressed={on} className="min-h-11 rounded-full border border-neutral-600 px-4 text-sm font-semibold hover:bg-neutral-800"
      onClick={() => { if (!ctx.current) ctx.current = new AudioContext(); setOn((v) => !v); }}>
      {on ? "🔔 Звук включён" : "🔕 Включить звук"}
    </button>
  );
}
