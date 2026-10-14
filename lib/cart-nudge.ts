/**
 * Напоминание о корзине от Мандаринки. Чистые правила и тексты: когда можно заговорить и что сказать.
 * Принцип: напомнить, а не надоедать. Не больше трёх раз за визит, не чаще раза в четыре минуты,
 * кнопка «Позже» отключает напоминания на полчаса, и ни слова на страницах корзины и оформления.
 */
export type NudgeReason = "idle" | "exit" | "back";
export type NudgeLang = "ru" | "uz";

export const NUDGE = {
  idleMs: 75_000,        // гость молчит столько — спрашиваем, не забыл ли он про корзину
  awayMs: 20 * 60_000,   // не заходил столько — при возвращении напоминаем
  minGapMs: 4 * 60_000,  // между двумя напоминаниями
  snoozeMs: 30 * 60_000, // после «Позже»
  maxPerSession: 3,
  showMs: 20_000,        // сколько висит пузырь, если его не трогать
} as const;

/** Страницы, где напоминать бессмысленно или мешает: гость уже в корзине, на оформлении, у заказа, у счёта стола, на брони. */
export const QUIET_PATHS = /^\/(cart|checkout|order|table|book)(\/|$)/;

export type NudgeState = {
  now: number; shown: number; lastShownAt: number | null; snoozedUntil: number | null;
  cartCount: number; quiet: boolean; visible: boolean;
  /** Открыт чат или Мандаринка бегает по странице, или уже показан пузырь */
  busy: boolean;
};

export function canNudge(s: NudgeState): boolean {
  if (s.cartCount <= 0 || s.quiet || !s.visible || s.busy) return false;
  if (s.shown >= NUDGE.maxPerSession) return false;
  if (s.snoozedUntil != null && s.now < s.snoozedUntil) return false;
  if (s.lastShownAt != null && s.now - s.lastShownAt < NUDGE.minGapMs) return false;
  return true;
}

/** Гость давно не заходил, а в корзине что-то осталось. */
export const isReturning = (lastSeen: number | null, now: number) => lastSeen != null && now - lastSeen > NUDGE.awayMs;

const ru = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
// неразрывные пробелы, чтобы «34 000 сум» не переносилось по строкам
const money = (n: number) => `${Math.round(n).toLocaleString("ru-RU").replace(/[\u00a0\u202f ]/g, "\u00a0")}\u00a0сум`;

export type NudgeFacts = { count: number; names: string[]; total: number | null; hint?: string | null };

/** «Манго-кокос», «А» и «Б», «А» и ещё 2 — коротко назвать, что лежит в корзине. */
function listText(f: NudgeFacts, lang: NudgeLang): string {
  const n = f.names;
  if (n.length === 0) return lang === "ru" ? `${f.count} ${ru(f.count, "позиция", "позиции", "позиций")}` : `${f.count} ta mahsulot`;
  if (n.length === 1) return `«${n[0]}»`;
  if (n.length === 2) return lang === "ru" ? `«${n[0]}» и «${n[1]}»` : `«${n[0]}» va «${n[1]}»`;
  const rest = n.length - 1;
  return lang === "ru" ? `«${n[0]}» и ещё ${rest}` : `«${n[0]}» va yana ${rest} ta`;
}

export function nudgeCopy(reason: NudgeReason, lang: NudgeLang, f: NudgeFacts): { title: string; text: string } {
  const list = listText(f, lang);
  const total = f.total != null ? (lang === "ru" ? ` — ${money(f.total)}` : ` — ${money(f.total).replace("сум", "so'm")}`) : "";
  const hint = lang === "ru" && f.hint ? `\n${f.hint}` : "";
  if (lang === "uz") {
    const title = reason === "idle" ? "Hali shu yerdamisiz?" : reason === "exit" ? "Ketyapsizmi?" : "Xush kelibsiz!";
    const text = reason === "back" ? `Savatda ${list}${total} kutmoqda.` : `Savatda ${list}${total}. Buyurtma beramizmi?`;
    return { title, text };
  }
  if (reason === "exit") return { title: "Уже уходите?", text: `В корзине ${list}${total}. Не забудьте оформить.${hint}` };
  if (reason === "back") return { title: "С возвращением!", text: `${list} всё ещё в корзине${total}.${hint}` };
  return { title: "Вы ещё здесь?", text: `В корзине ${list}${total}. Оформим?${hint}` };
}

/** Заголовок вкладки, пока гость на другой вкладке, а в корзине что-то есть. */
export const tabTitle = (lang: NudgeLang) => (lang === "ru" ? "🍊 Ваш заказ ждёт" : "🍊 Buyurtmangiz kutmoqda");
