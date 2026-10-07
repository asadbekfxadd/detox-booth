"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { mandarinAction } from "@/app/(site)/mandarin-actions";
import type { MandarinPick } from "@/services/mandarin";
import { useCart } from "@/lib/cart-store";
import { sum } from "@/lib/format";
import { GREETING_TEXT, STARTER_CHIPS, type Lang } from "@/lib/mandarin/rules";
import { ProductImage } from "@/components/site/ProductImage";
import { MandarinCharacter, type MandarinState } from "./MandarinCharacter";

type Msg = { id: number; role: "bot" | "user"; text: string; picks?: MandarinPick[]; cta?: { label: string; href: string } };
type Pos = { x: number; y: number };

const UI = {
  ru: {
    name: "Мандаринка", sub: "Помогу выбрать", open: "Открыть помощницу Мандаринку", close: "Закрыть", placeholder: "Что хочется? Например, «смузи без банана»",
    send: "Отправить", show: "Показать", add: "В корзину", added: (n: string) => `Добавила «${n}» в корзину. Что-нибудь ещё?`, cart: "Открыть корзину",
    hello: "Привет! Помочь выбрать? 🍊", here: "Вот она!", other: "Другое", back: "Спасибо!", thinking: "Думаю", err: "Не получилось ответить. Попробуйте ещё раз.", lang: "Язык",
  },
  uz: {
    name: "Mandarinka", sub: "Tanlashga yordam beraman", open: "Mandarinka yordamchisini ochish", close: "Yopish", placeholder: "Nima xohlaysiz? Masalan, «bananasiz smuzi»",
    send: "Yuborish", show: "Ko'rsatish", add: "Savatga", added: (n: string) => `«${n}» savatga qo'shildi. Yana nimadir kerakmi?`, cart: "Savatni ochish",
    hello: "Salom! Tanlashga yordam beraymi? 🍊", here: "Mana u!", other: "Boshqa", back: "Rahmat!", thinking: "O'ylayapman", err: "Javob bera olmadim. Yana urinib ko'ring.", lang: "Til",
  },
} as const;

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const noop = () => () => {};
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

/** Ждёт, пока плавная прокрутка закончится (положение элемента перестало меняться). */
async function settle(el: HTMLElement, max = 1400) {
  let last = el.getBoundingClientRect().top, still = 0;
  for (let t = 0; t < max && still < 3; t += 60) {
    await wait(60);
    const top = el.getBoundingClientRect().top;
    still = Math.abs(top - last) < 1 ? still + 1 : 0;
    last = top;
  }
}

export function MandarinAssistant() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const pathname = usePathname();
  const router = useRouter();
  const addToCart = useCart((s) => s.add);

  const [lang, setLang] = useState<Lang>("ru");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chips, setChips] = useState<string[]>(STARTER_CHIPS.ru);
  const [state, setState] = useState<MandarinState>("idle");
  const [face, setFace] = useState<1 | -1>(-1);
  const [pos, setPos] = useState<Pos>({ x: -300, y: -300 });
  const [dur, setDur] = useState(0);
  const [away, setAway] = useState(false);
  const [bubble, setBubble] = useState<{ kind: "hello" } | { kind: "arrive"; pick: MandarinPick } | null>(null);
  const [size, setSize] = useState(84);

  const posRef = useRef<Pos>(pos);
  const awayRef = useRef(false);
  const runId = useRef(0);
  const shown = useRef<string[]>([]);
  const nextId = useRef(1);
  const glowEl = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const arriveScroll = useRef(0);
  const openRef = useRef(false);
  const t = UI[lang];

  const home = useCallback((s = size): Pos => ({ x: window.innerWidth - s - 12, y: window.innerHeight - s * 1.25 - 14 }), [size]);
  const place = (p: Pos) => { posRef.current = p; setPos(p); };

  // старт: размер, язык, домашняя позиция, приветствие
  useEffect(() => {
    if (!mounted) return;
    const s = window.innerWidth < 640 ? 68 : 84;
    const saved = safe(() => localStorage.getItem("mandarin-lang"), null);
    const l: Lang = saved === "uz" ? "uz" : "ru";
    const id = requestAnimationFrame(() => {
      setSize(s); setLang(l); setChips(STARTER_CHIPS[l]);
      setMsgs([{ id: nextId.current++, role: "bot", text: GREETING_TEXT[l] }]);
      place({ x: window.innerWidth - s - 12, y: window.innerHeight - s * 1.25 - 14 });
    });
    return () => cancelAnimationFrame(id);
  }, [mounted]);

  // при изменении окна Мандаринка остаётся дома
  useEffect(() => {
    if (!mounted) return;
    const onResize = () => {
      const s = window.innerWidth < 640 ? 68 : 84;
      setSize(s);
      if (!awayRef.current) place(home(s));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted, home]);

  // приветственный пузырь один раз за сессию
  useEffect(() => {
    if (!mounted || !/^\/(menu)?$/.test(pathname)) return;
    if (safe(() => sessionStorage.getItem("mandarin-hello"), "1")) return;
    const show = window.setTimeout(() => {
      if (awayRef.current || openRef.current) return; // гость уже общается с мандаринкой: не перебиваем
      setBubble((cur) => cur ?? { kind: "hello" }); setState("point"); safe(() => sessionStorage.setItem("mandarin-hello", "1"), null);
    }, 7000);
    const hide = window.setTimeout(() => { setBubble((b) => (b?.kind === "hello" ? null : b)); setState((s) => (s === "point" && !awayRef.current ? "idle" : s)); }, 15000);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [mounted, pathname]);

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy, open]);
  useEffect(() => { openRef.current = open; if (open) inputRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const clearGlow = () => { glowEl.current?.classList.remove("mandarin-glow"); glowEl.current = null; };

  const moveTo = useCallback((target: Pos) => new Promise<void>((resolve) => {
    const from = posRef.current;
    const ms = reducedMotion() ? 0 : Math.round(Math.min(1500, Math.max(450, Math.hypot(target.x - from.x, target.y - from.y) * 1.1)));
    setFace(target.x < from.x - 4 ? -1 : target.x > from.x + 4 ? 1 : face);
    setState("run"); setDur(ms); place(target);
    window.setTimeout(resolve, ms + 40);
  }), [face]);

  const goHome = useCallback(async () => {
    const id = ++runId.current;
    clearGlow(); setBubble(null);
    if (awayRef.current) await moveTo(home());
    if (id !== runId.current) return;
    awayRef.current = false; setAway(false); setFace(-1); setState("idle");
  }, [moveTo, home]);

  // ушли прокруткой от карточки: возвращаемся домой
  useEffect(() => {
    if (!away) return;
    const onScroll = () => { if (Math.abs(window.scrollY - arriveScroll.current) > 220) void goHome(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [away, goHome]);

  /** Бежит к карточке товара на странице, подсвечивает её и показывает пузырь с кнопками. */
  const runTo = useCallback(async (pick: MandarinPick) => {
    const id = ++runId.current;
    setOpen(false); setBubble(null); clearGlow();
    const find = () => document.querySelector<HTMLElement>(`[data-product="${CSS.escape(pick.slug)}"]`);
    let el = find();
    if (!el) {
      if (window.location.pathname + window.location.search !== "/menu") router.push("/menu");
      for (let i = 0; i < 28 && !el; i++) { await wait(120); el = find(); }
    }
    if (id !== runId.current) return;
    if (!el) { router.push(`/menu/${pick.slug}`); void goHome(); return; }
    el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
    await settle(el);
    if (id !== runId.current) return;
    const r = el.getBoundingClientRect();
    const target: Pos = {
      x: Math.min(window.innerWidth - size - 6, Math.max(6, r.right - size * 0.85)),
      y: Math.min(window.innerHeight - size * 1.25 - 6, Math.max(70, r.top - size * 0.6)),
    };
    arriveScroll.current = window.scrollY;
    awayRef.current = true; setAway(true);
    await moveTo(target);
    if (id !== runId.current) return;
    arriveScroll.current = window.scrollY;
    el.classList.add("mandarin-glow"); glowEl.current = el;
    setFace(1); setState("point"); setBubble({ kind: "arrive", pick });
  }, [moveTo, goHome, router, size]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    const history = msgs.slice(-8).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { id: nextId.current++, role: "user", text }]);
    setChips([]); setBusy(true); setState("talk");
    const res = await mandarinAction({ text, lang, history, shown: shown.current }).catch(() => ({ error: t.err }));
    setBusy(false); setState(awayRef.current ? "point" : "idle");
    if ("error" in res) { setMsgs((m) => [...m, { id: nextId.current++, role: "bot", text: res.error }]); setChips(STARTER_CHIPS[lang]); return; }
    if (res.lang !== lang) { setLang(res.lang); safe(() => localStorage.setItem("mandarin-lang", res.lang), null); }
    shown.current = [...new Set([...shown.current, ...res.picks.map((p) => p.slug)])].slice(-30);
    setMsgs((m) => [...m, { id: nextId.current++, role: "bot", text: res.reply, picks: res.picks }]);
    setChips(res.chips);
  }, [busy, msgs, lang, t.err]);

  const add = (p: MandarinPick) => {
    addToCart({ productId: p.id, quantity: 1, optionIds: p.optionIds });
    setMsgs((m) => [...m, { id: nextId.current++, role: "bot", text: t.added(p.name), cta: { label: t.cart, href: "/cart" } }]);
    if (bubble?.kind === "arrive") { setBubble(null); void goHome(); }
    setOpen(true);
  };

  const changeLang = (l: Lang) => {
    setLang(l); safe(() => localStorage.setItem("mandarin-lang", l), null);
    setChips(STARTER_CHIPS[l]);
    setMsgs((m) => (m.length <= 1 ? [{ id: nextId.current++, role: "bot", text: GREETING_TEXT[l] }] : m));
  };

  if (!mounted || /^\/(checkout|order)(\/|$)/.test(pathname)) return null;

  const above = pos.y > 190;
  const alignLeft = pos.x < 280;
  const w = size, h = size * 1.25;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" data-mandarin>
      {open && (
        <section role="dialog" aria-label={t.name}
          className="pointer-events-auto fixed inset-x-2 flex max-h-[min(34rem,calc(100dvh-8rem))] flex-col overflow-hidden rounded-3xl border border-forest/15 bg-cream shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[24rem]"
          style={{ bottom: `calc(${Math.round(w * 1.25) + 26}px + env(safe-area-inset-bottom))` }}>
          <header className="flex items-center gap-3 bg-linear-to-r from-sun to-orange px-4 py-3 text-forest-deep">
            <div className="min-w-0 flex-1">
              <p className="display text-lg font-black leading-none">{t.name}</p>
              <p className="text-xs font-semibold opacity-80">{t.sub}</p>
            </div>
            <div className="flex overflow-hidden rounded-full bg-white/70 text-xs font-extrabold" role="group" aria-label={t.lang}>
              {(["ru", "uz"] as const).map((l) => (
                <button key={l} type="button" onClick={() => changeLang(l)} aria-pressed={lang === l} className={`px-2.5 py-1 ${lang === l ? "bg-forest text-white" : "text-forest"}`}>{l.toUpperCase()}</button>
              ))}
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="grid h-8 w-8 place-items-center rounded-full bg-white/70 text-lg font-black leading-none hover:bg-white">×</button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-live="polite">
            {msgs.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-2"}>
                <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-snug ${m.role === "user" ? "rounded-br-md bg-forest text-white" : "rounded-bl-md bg-white text-forest-deep ring-1 ring-forest/10"}`}>{m.text}</p>
                {m.picks?.map((p) => (
                  <div key={p.slug} className="flex w-full gap-3 rounded-2xl bg-white p-2 ring-1 ring-forest/10">
                    <div className="w-16 shrink-0"><ProductImage image={p.image} name={p.name} categorySlug={p.category} shape="thumb" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="display text-sm font-bold leading-tight">{p.name}</p>
                      {p.why && <p className="text-xs text-forest/60">{p.why}</p>}
                      <p className="mt-0.5 text-sm font-extrabold text-forest">{sum(p.price)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => void runTo(p)} className="rounded-full border border-forest/30 px-3 py-1 text-xs font-bold text-forest hover:bg-forest hover:text-white">{t.show}</button>
                        <button type="button" onClick={() => add(p)} className="rounded-full bg-linear-to-br from-sun to-orange px-3 py-1 text-xs font-extrabold text-forest-deep">+ {t.add}</button>
                      </div>
                    </div>
                  </div>
                ))}
                {m.cta && <Link href={m.cta.href} onClick={() => setOpen(false)} className="rounded-full bg-forest px-4 py-1.5 text-xs font-bold text-white">{m.cta.label}</Link>}
              </div>
            ))}
            {busy && <p className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 text-forest/70 ring-1 ring-forest/10" role="status" aria-label={t.thinking}><span className="mdr-dot" /><span className="mdr-dot" /><span className="mdr-dot" /></p>}
            {!busy && chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {chips.map((c) => <button key={c} type="button" onClick={() => void send(c)} className="rounded-full border border-orange bg-white px-3 py-1.5 text-sm font-bold text-orange-deep hover:bg-orange hover:text-forest-deep">{c}</button>)}
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = inputRef.current?.value ?? ""; if (inputRef.current) inputRef.current.value = ""; void send(v); f.reset(); }}
            className="flex gap-2 border-t border-forest/10 bg-white p-3">
            <input ref={inputRef} name="ask" maxLength={400} autoComplete="off" placeholder={t.placeholder} aria-label={t.placeholder} disabled={busy}
              className="min-w-0 flex-1 rounded-full border border-forest/20 bg-cream px-4 py-2 text-sm outline-none focus:border-orange" />
            <button disabled={busy} className="btn btn-primary px-4! py-2! text-sm">{t.send}</button>
          </form>
        </section>
      )}

      <div className="pointer-events-none absolute left-0 top-0" style={{ width: w, height: h, transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, transition: `transform ${dur}ms cubic-bezier(0.5, 0.1, 0.3, 1)` }}>
        {bubble && (
          <div role="status" className={`pointer-events-auto absolute w-60 rounded-2xl bg-white p-3 text-sm shadow-xl ring-1 ring-forest/15 ${above ? "bottom-full mb-1" : "top-full mt-1"} ${alignLeft ? "left-0" : "right-0"}`}>
            {bubble.kind === "hello" ? (
              <button type="button" className="text-left font-bold text-forest-deep" onClick={() => { setBubble(null); setState("idle"); setOpen(true); }}>{t.hello}</button>
            ) : (
              <>
                <p className="font-extrabold text-forest-deep">{t.here}</p>
                <p className="mt-0.5 display text-sm font-bold leading-tight">{bubble.pick.name}</p>
                <p className="text-sm font-extrabold text-forest">{sum(bubble.pick.price)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => add(bubble.pick)} className="rounded-full bg-linear-to-br from-sun to-orange px-3 py-1 text-xs font-extrabold text-forest-deep">+ {t.add}</button>
                  <button type="button" onClick={() => { setBubble(null); void goHome().then(() => setOpen(true)); }} className="rounded-full border border-forest/30 px-3 py-1 text-xs font-bold text-forest">{t.other}</button>
                  <button type="button" onClick={() => void goHome()} className="rounded-full px-2 py-1 text-xs font-bold text-forest/60 hover:text-forest">{t.back}</button>
                </div>
              </>
            )}
          </div>
        )}
        <button type="button" aria-label={t.open} aria-expanded={open} aria-haspopup="dialog"
          onClick={() => { if (awayRef.current) void goHome(); setBubble(null); setOpen((o) => !o); setState((s) => (s === "point" ? "idle" : s)); }}
          className="pointer-events-auto block h-full w-full cursor-pointer drop-shadow-[0_10px_14px_rgba(7,45,23,0.25)] transition-transform hover:scale-105 focus-visible:scale-105">
          <MandarinCharacter state={state} face={face} />
        </button>
      </div>
    </div>
  );
}
