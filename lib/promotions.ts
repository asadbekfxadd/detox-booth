import { tashkentClock, hhmm, DAY_LABEL } from "@/lib/happy-hour";

/**
 * Движок акций: чистые функции без базы. Акция применяется к корзине сама, без промокода.
 * Сначала работают акции на позиции (BUY_GET, COMBO): каждая штука участвует только в одной акции.
 * Затем из акций на сумму (THRESHOLD, FIRST_ORDER) берётся одна, самая выгодная для гостя.
 */
export type PromoKind = "BUY_GET" | "COMBO" | "THRESHOLD" | "FIRST_ORDER";

export type BuyGetConfig = { productIds: string[]; categoryId: string | null; buy: number; free: number; percent: number };
export type ComboConfig = { items: { productId: string; qty: number }[]; price: number };
export type Tier = { from: number; percent?: number; off?: number };
export type ThresholdConfig = { tiers: Tier[] };
export type FirstOrderConfig = { percent: number; maxOff: number | null };

export type PromoRule = {
  id: string; name: string; kind: PromoKind; sort: number;
  config: BuyGetConfig | ComboConfig | ThresholdConfig | FirstOrderConfig;
  allowCode: boolean; withHappyHour: boolean;
  /** Подписи для подсказок: название позиции/категории (BUY_GET) и позиций набора (COMBO) */
  labels?: { target?: string; items?: Record<string, string> };
};

export type CartLine = { productId: string; categoryId: string; quantity: number; unitPrice: number; happy: boolean };
export type Applied = { id: string; name: string; amount: number; allowCode: boolean };
export type Hint = { id: string; name: string; text: string };
export type EvalResult = { discount: number; applied: Applied[]; hints: Hint[] };

type Unit = { productId: string; categoryId: string; price: number; happy: boolean; used: boolean };

const money = (n: number) => `${Math.round(n).toLocaleString("ru-RU").replace(/ | /g, " ")} сум`;
const r = Math.round;

function expand(lines: CartLine[]): Unit[] {
  const out: Unit[] = [];
  for (const l of lines) for (let i = 0; i < l.quantity; i++) out.push({ productId: l.productId, categoryId: l.categoryId, price: l.unitPrice, happy: l.happy, used: false });
  return out;
}

const free = (rule: PromoRule, u: Unit) => !u.used && (rule.withHappyHour || !u.happy);

function buyGet(rule: PromoRule, c: BuyGetConfig, units: Unit[]): { amount: number; hint: string | null } {
  const match = units.filter((u) => free(rule, u) && (c.productIds.includes(u.productId) || (c.categoryId != null && u.categoryId === c.categoryId)));
  match.sort((a, b) => b.price - a.price);
  const g = c.buy + c.free;
  const groups = Math.floor(match.length / g);
  let amount = 0;
  for (let k = 0; k < groups; k++) {
    const grp = match.slice(k * g, (k + 1) * g);
    grp.forEach((u) => { u.used = true; });
    for (const u of grp.slice(c.buy)) amount += (u.price * c.percent) / 100;
  }
  const rest = match.length - groups * g;
  let hint: string | null = null;
  if (rest > 0) {
    const need = g - rest;
    const what = rule.labels?.target ? ` «${rule.labels.target}»` : "";
    const prize = c.percent >= 100 ? (c.free === 1 ? "одна бесплатно" : `${c.free} бесплатно`) : `${c.free === 1 ? "одна" : c.free} со скидкой ${c.percent}%`;
    hint = `Добавьте ещё ${need} шт.${what} — ${prize}`;
  }
  return { amount: r(amount), hint };
}

function combo(rule: PromoRule, c: ComboConfig, units: Unit[]): { amount: number; hint: string | null } {
  const avail = c.items.map((it) => units.filter((u) => free(rule, u) && u.productId === it.productId).sort((a, b) => b.price - a.price));
  const sets = Math.min(...c.items.map((it, i) => Math.floor(avail[i].length / it.qty)));
  let amount = 0;
  if (sets > 0) {
    for (let s = 0; s < sets; s++) {
      let sum = 0;
      c.items.forEach((it, i) => {
        for (const u of avail[i].slice(s * it.qty, (s + 1) * it.qty)) { u.used = true; sum += u.price; }
      });
      amount += Math.max(0, sum - c.price);
    }
    return { amount: r(amount), hint: null };
  }
  const missing = c.items.filter((it, i) => avail[i].length < it.qty);
  const present = c.items.length - missing.length;
  let hint: string | null = null;
  if (missing.length === 1 && present >= 1) {
    const name = rule.labels?.items?.[missing[0].productId] ?? "ещё одну позицию";
    hint = `Добавьте «${name}» — набор «${rule.name}» за ${money(c.price)}`;
  }
  return { amount: 0, hint };
}

const tierAmount = (t: Tier, base: number) => (t.percent != null ? r((base * t.percent) / 100) : Math.min(t.off ?? 0, r(base)));
const tierText = (t: Tier) => (t.percent != null ? `скидка ${t.percent}%` : `скидка ${money(t.off ?? 0)}`);

/**
 * firstOrder: true — первый заказ клиента, false — не первый, null — клиент пока неизвестен (подскажем ввести телефон).
 */
export function evaluate(rules: PromoRule[], lines: CartLine[], ctx: { firstOrder: boolean | null }): EvalResult {
  const subtotal = lines.reduce((a, l) => a + l.unitPrice * l.quantity, 0);
  const units = expand(lines);
  const applied: Applied[] = [];
  const hints: Hint[] = [];
  const ordered = [...rules].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ru"));
  let itemDiscount = 0;

  for (const rule of ordered) {
    if (rule.kind !== "BUY_GET" && rule.kind !== "COMBO") continue;
    const res = rule.kind === "BUY_GET" ? buyGet(rule, rule.config as BuyGetConfig, units) : combo(rule, rule.config as ComboConfig, units);
    if (res.amount > 0) { applied.push({ id: rule.id, name: rule.name, amount: res.amount, allowCode: rule.allowCode }); itemDiscount += res.amount; }
    if (res.hint) hints.push({ id: rule.id, name: rule.name, text: res.hint });
  }

  const base = Math.max(0, subtotal - itemDiscount);
  let best: { rule: PromoRule; amount: number } | null = null;
  for (const rule of ordered) {
    let amount = 0;
    if (rule.kind === "THRESHOLD") {
      const tiers = (rule.config as ThresholdConfig).tiers;
      const cur = tiers.filter((t) => base >= t.from).map((t) => tierAmount(t, base)).reduce((a, b) => Math.max(a, b), 0);
      amount = cur;
      const next = tiers.filter((t) => t.from > base).sort((a, b) => a.from - b.from)[0];
      if (next && base > 0) hints.push({ id: rule.id, name: rule.name, text: `Добавьте ещё ${money(next.from - base)} — ${tierText(next)}` });
    } else if (rule.kind === "FIRST_ORDER") {
      const c = rule.config as FirstOrderConfig;
      if (ctx.firstOrder === true) { amount = r((base * c.percent) / 100); if (c.maxOff != null) amount = Math.min(amount, c.maxOff); }
      else if (ctx.firstOrder === null) hints.push({ id: rule.id, name: rule.name, text: `Скидка ${c.percent}% на первый заказ — укажите телефон клиента` });
    }
    if (amount > 0 && (!best || amount > best.amount)) best = { rule, amount };
  }
  if (best) applied.push({ id: best.rule.id, name: best.rule.name, amount: best.amount, allowCode: best.rule.allowCode });

  let discount = applied.reduce((a, x) => a + x.amount, 0);
  if (discount > subtotal) {
    // страховка: скидка не может превышать сумму заказа
    discount = r(subtotal);
    const over = applied.reduce((a, x) => a + x.amount, 0) - discount;
    const last = applied[applied.length - 1];
    if (last) last.amount = Math.max(0, last.amount - over);
  }
  return { discount, applied, hints };
}

// ───────────── Расписание и описание ─────────────
export type Schedule = { days: number[]; startMin: number; endMin: number; startsAt: Date | null; endsAt: Date | null };

export function inSchedule(s: Schedule, atMs: number): boolean {
  if (s.startsAt && atMs < s.startsAt.getTime()) return false;
  if (s.endsAt && atMs > s.endsAt.getTime()) return false;
  const { dow, min } = tashkentClock(atMs);
  if (s.days.length > 0 && !s.days.includes(dow)) return false;
  const end = s.endMin >= 1439 ? 1440 : s.endMin; // «до 23:59» значит до конца дня
  return min >= s.startMin && min < end;
}

export function scheduleText(s: Schedule): string {
  const parts: string[] = [];
  if (s.days.length > 0 && s.days.length < 7) parts.push(s.days.map((d) => DAY_LABEL[d]).join(", "));
  if (s.startMin > 0 || s.endMin < 1439) parts.push(`${hhmm(s.startMin)}–${hhmm(Math.min(s.endMin, 1439))}`);
  const d = (x: Date) => new Date(x.getTime() + 5 * 3600000).toISOString().slice(0, 10).split("-").reverse().join(".");
  if (s.startsAt && s.endsAt) parts.push(`${d(s.startsAt)} – ${d(s.endsAt)}`);
  else if (s.endsAt) parts.push(`до ${d(s.endsAt)}`);
  else if (s.startsAt) parts.push(`с ${d(s.startsAt)}`);
  return parts.join(", ");
}

/** Короткое условие акции для витрины и админки. */
export function describeRule(rule: Pick<PromoRule, "kind" | "config" | "labels">, price?: { comboSum?: number }): string {
  if (rule.kind === "BUY_GET") {
    const c = rule.config as BuyGetConfig;
    const what = rule.labels?.target ?? "позиций";
    const prize = c.percent >= 100 ? `${c.free === 1 ? "ещё одна" : `ещё ${c.free}`} бесплатно` : `${c.free === 1 ? "следующая" : `следующие ${c.free}`} со скидкой ${c.percent}%`;
    return `Купите ${c.buy} шт. (${what}) — ${prize}`;
  }
  if (rule.kind === "COMBO") {
    const c = rule.config as ComboConfig;
    const names = c.items.map((i) => `${i.qty > 1 ? `${i.qty}× ` : ""}${rule.labels?.items?.[i.productId] ?? "позиция"}`).join(" + ");
    const save = price?.comboSum != null && price.comboSum > c.price ? ` (выгода ${money(price.comboSum - c.price)})` : "";
    return `${names} за ${money(c.price)}${save}`;
  }
  if (rule.kind === "THRESHOLD") {
    const c = rule.config as ThresholdConfig;
    return [...c.tiers].sort((a, b) => a.from - b.from).map((t) => `от ${money(t.from)} — ${tierText(t)}`).join("; ");
  }
  const c = rule.config as FirstOrderConfig;
  return `Скидка ${c.percent}% на первый заказ${c.maxOff != null ? ` (не больше ${money(c.maxOff)})` : ""}`;
}

export const KIND_LABEL: Record<PromoKind, string> = {
  BUY_GET: "Купи N — получи бесплатно", COMBO: "Набор по фиксированной цене", THRESHOLD: "Скидка от суммы заказа", FIRST_ORDER: "Скидка на первый заказ",
};
