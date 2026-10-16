"use client";
import { useState } from "react";

/** Готовое описание для AI-генератора видео. Копируется одним нажатием, текст можно поправить перед копированием. */
export function VideoPromptHelper({ prompt }: { prompt: string }) {
  const [text, setText] = useState(prompt);
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); }
    catch { /* без доступа к буферу гость выделит текст сам */ return; }
    setDone(true); window.setTimeout(() => setDone(false), 1800);
  }
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 font-semibold">Описание для AI-видео</h2>
      <p className="mb-3 text-sm text-neutral-500">Вставьте этот текст в генератор видео (Veo, Kling, Runway, Sora и подобные), скачайте ролик, загрузите на YouTube и вставьте ссылку в поле «Видео» выше. AI-ролик показывает, как выглядит напиток, а не настоящее приготовление у вас, поэтому настоящую съёмку с кухни ставьте, когда она появится.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-label="Описание для AI-видео" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-green-600" />
      <button type="button" onClick={copy} className="mt-2 rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800">{done ? "Скопировано ✓" : "Скопировать"}</button>
    </section>
  );
}
