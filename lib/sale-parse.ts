import { mlOf, SIZE_MODIFIER_NAME } from "@/lib/recipe-size";

/**
 * Разбор продаж, записанных текстом в боте: «яблочный сок», «2 латте 0.5», «капучино, 3 американо карта».
 * Чистые функции без базы: список продуктов приходит параметром, поэтому всё покрыто тестами.
 */
export type Method = "CASH" | "CARD" | "ONLINE";
export type MatchOption = { id: string; name: string; priceDelta: number };
export type MatchModifier = { id: string; name: string; multiple: boolean; required: boolean; options: MatchOption[] };
export type MatchProduct = { id: string; name: string; price: number; modifiers: MatchModifier[] };

export type SaleLine = { productId: string; name: string; quantity: number; optionIds: string[]; optionNames: string[]; unit: number };
export type LineError = { raw: string; reason: "unknown" | "ambiguous" | "size"; candidates?: string[] };
export type ParsedSale = { method: Method; lines: SaleLine[]; errors: LineError[] };

const GENERIC = new Set(["сок", "фреш", "смузи", "напиток", "кофе", "коктейль", "свежий", "свежевыжатый", "натуральный"]);
/** «сок», «сока», «соки» — одно и то же общее слово */
const isGeneric = (w: string) => [...GENERIC].some((g) => w === g || stem(w) === stem(g));
const NUMBER_WORDS: Record<string, number> = {
  один: 1, одна: 1, одну: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
};
const PAY_WORDS: [Method, RegExp][] = [
  ["CARD", /^(карта|картой|карту|карте|терминал|терминалом|card|uzcard|humo|хумо|узкард)$/],
  ["ONLINE", /^(онлайн|online|click|клик|payme|пейме|пэйме|перевод|переводом)$/],
  ["CASH", /^(наличными|наличка|наличные|нал|кэш|кеш|cash)$/],
];
const NOISE = new Set(["шт", "штуки", "штука", "штук", "порция", "порции", "порций", "по", "и"]);

export const normalize = (s: string) =>
  s.toLowerCase().replace(/ё/g, "е").replace(/(\d),(\d)/g, "$1.$2").replace(/[«»"'`()!?:#№]/g, " ").replace(/[–—]/g, "-");

const SUFFIXES = ["ами", "ями", "ого", "его", "ому", "ему", "ыми", "ими", "ый", "ий", "ой", "ая", "яя", "ое", "ее", "ые", "ие", "ую", "юю", "ых", "их", "ым", "им", "ом", "ем", "ов", "ев", "ей", "ам", "ям", "ах", "ях", "а", "я", "у", "ю", "е", "ы", "и", "о", "ь", "й"];
/** Грубая основа слова: «яблочного» → «яблочн», «соки» → «сок». Хватает, чтобы падежи и множественное число совпадали. */
export function stem(w: string): string {
  if (w.length <= 3) return w;
  for (const s of SUFFIXES) if (w.endsWith(s) && w.length - s.length >= 3) return w.slice(0, -s.length);
  return w;
}

export const words = (s: string) => normalize(s).split(/[^a-zа-я0-9.]+/).map((w) => w.replace(/^\.+|\.+$/g, "")).filter(Boolean);

/** Совпадение слова запроса со словом названия: 1 — основа та же, 0.85 — одно начинается с другого (сокращение «капуч»), иначе 0 */
export function sim(q: string, p: string): number {
  if (q === p) return 1;
  const a = stem(q), b = stem(p);
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.85;
  return 0;
}

/** Число-объём: «0.5» → 500 мл, «500» → 500, «1л» → 1000. Маленькое целое без единицы (1..50) — это количество, не объём. */
function volumeOf(tok: string, next?: string): { ml: number; consumeNext: boolean } | null {
  const joined = /^(\d+(?:\.\d+)?)(мл|ml|л|l)$/.exec(tok);
  if (joined) { const ml = mlOf(`${joined[1]} ${joined[2]}`); return ml ? { ml, consumeNext: false } : null; }
  if (!/^\d+(?:\.\d+)?$/.test(tok)) return null;
  const n = Number(tok);
  if (next && /^(мл|ml|л|l|литр|литра)$/.test(next)) { const ml = Math.round(/^(мл|ml)$/.test(next) ? n : n * 1000); return ml > 0 ? { ml, consumeNext: true } : null; }
  if (tok.includes(".") && n < 10) return { ml: Math.round(n * 1000), consumeNext: false };
  if (Number.isInteger(n) && n >= 100) return { ml: n, consumeNext: false };
  return null;
}

type Cooked = { name: string[]; quantity: number; ml: number | null; bad: string[] };

/** Разбирает одну позицию на количество, объём и слова названия */
function cook(entry: string): Cooked {
  const n = normalize(entry)
    .replace(/(\d)\s*[xх×*](?![a-zа-я])/g, "$1 ")
    .replace(/(^|[^a-zа-я])[xх×*]\s*(\d)/g, "$1$2");
  const toks = n.split(/[^a-zа-я0-9.]+/).map((w) => w.replace(/^\.+|\.+$/g, "")).filter(Boolean);
  const out: string[] = [];
  let ml: number | null = null;
  const nums: number[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const v = volumeOf(t, toks[i + 1]);
    if (v) { ml = v.ml; if (v.consumeNext) i++; continue; }
    if (/^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= 50) { nums.push(Number(t)); continue; }
    if (t in NUMBER_WORDS) { nums.push(NUMBER_WORDS[t]); continue; }
    if (NOISE.has(t)) continue;
    out.push(t);
  }
  return { name: out, quantity: nums[0] ?? 1, ml, bad: nums.length > 1 ? ["количество указано дважды"] : [] };
}

type Cand = { product: MatchProduct; score: number; optionIds: string[]; optionNames: string[]; unit: number };

/** Подходит ли продукт под слова запроса и с какой уверенностью; слова, не нашедшиеся в названии, могут оказаться опциями («молоко») */
function evaluate(product: MatchProduct, c: Cooked): Cand | { sizeFail: string[] } | null {
  const pTok = words(product.name).map((w) => ({ w, generic: isGeneric(w) }));
  const strong = pTok.filter((t) => !t.generic);
  const qStrong = c.name.filter((w) => !isGeneric(w));
  const qGeneric = c.name.filter((w) => isGeneric(w));
  const queryWords = qStrong.length ? qStrong : qGeneric;
  if (!queryWords.length) return null;

  const chosen: MatchOption[] = [];
  let matched = 0, nameQ = 0, bonus = 0, rest = 0;
  const coveredStrong = new Set<number>();
  for (const q of queryWords) {
    let best = 0, bestIdx = -1;
    pTok.forEach((t, i) => { if (qStrong.length && t.generic) return; const s = sim(q, t.w); if (s > best) { best = s; bestIdx = i; } });
    if (best > 0) { matched += best; nameQ++; coveredStrong.add(bestIdx); continue; }
    // слово не из названия: может быть опцией этого продукта
    const opt = product.modifiers.filter((m) => !SIZE_MODIFIER_NAME.test(m.name) || !m.required)
      .flatMap((m) => m.options.map((o) => ({ m, o }))).find(({ o }) => words(o.name).some((ow) => sim(q, ow) >= 0.85));
    if (opt) { if (!chosen.some((x) => x.id === opt.o.id)) chosen.push(opt.o); continue; }
    rest++;
  }
  if (rest > 0 || matched === 0) return null;
  if (qStrong.length) for (const g of qGeneric) if (pTok.some((t) => t.generic && sim(g, t.w) === 1)) bonus += 0.05;

  const qScore = matched / Math.max(1, nameQ);
  const coverage = strong.length ? [...coveredStrong].filter((i) => !pTok[i].generic).length / strong.length : 1;
  const score = qScore * 0.6 + coverage * 0.4 + bonus;

  // обязательные модификаторы: объём берём из запроса, остальное первый (самый дешёвый) вариант
  const optionIds = chosen.map((o) => o.id), optionNames = chosen.map((o) => o.name);
  let unit = product.price + chosen.reduce((a, o) => a + o.priceDelta, 0);
  for (const m of product.modifiers) {
    if (!m.required || m.multiple || chosen.some((o) => m.options.some((x) => x.id === o.id))) continue;
    let pick: MatchOption | undefined;
    if (c.ml != null && SIZE_MODIFIER_NAME.test(m.name)) {
      pick = m.options.find((o) => mlOf(o.name) === c.ml);
      if (!pick) return { sizeFail: m.options.map((o) => o.name) };
    } else pick = m.options[0];
    if (pick) { optionIds.push(pick.id); optionNames.push(pick.name); unit += pick.priceDelta; }
  }
  return { product, score, optionIds, optionNames, unit };
}

const MARGIN = 0.04;
const MIN_SCORE = 0.55;

/** Одна позиция: найденный продукт или причина, почему не получилось */
export function matchEntry(entry: string, products: MatchProduct[]): { ok: true; line: SaleLine } | { ok: false; error: LineError } {
  const c = cook(entry);
  const raw = entry.trim();
  if (c.bad.length) return { ok: false, error: { raw, reason: "unknown" } };
  const cands: Cand[] = [];
  let sizeFail: string[] | null = null;
  for (const p of products) {
    const r = evaluate(p, c);
    if (!r) continue;
    if ("sizeFail" in r) { sizeFail ??= r.sizeFail; continue; }
    if (r.score >= MIN_SCORE) cands.push(r);
  }
  if (!cands.length) return { ok: false, error: sizeFail ? { raw, reason: "size", candidates: sizeFail } : { raw, reason: "unknown" } };
  cands.sort((a, b) => b.score - a.score);
  const top = cands[0];
  const near = cands.filter((x) => top.score - x.score < MARGIN);
  if (near.length > 1) return { ok: false, error: { raw, reason: "ambiguous", candidates: near.slice(0, 4).map((x) => x.product.name) } };
  return { ok: true, line: { productId: top.product.id, name: top.product.name, quantity: c.quantity, optionIds: top.optionIds, optionNames: top.optionNames, unit: top.unit } };
}

/** Способ оплаты по словам сообщения; найденные слова вырезаем, чтобы они не мешали разбору позиций */
function takeMethod(text: string): { method: Method; rest: string } {
  let method: Method | null = null;
  const rest = normalize(text).split(/(\s+|,|;|\+)/).filter((t) => {
    const w = t.trim();
    const hit = PAY_WORDS.find(([, re]) => re.test(w));
    if (!hit) return true;
    method ??= hit[0];
    return false;
  }).join("");
  return { method: method ?? "CASH", rest };
}

/** Сообщение целиком: строки и запятые разделяют позиции. Если строка целиком совпала с продуктом («Морковь, яблоко, имбирь»), запятые не режем. */
export function parseSale(text: string, products: MatchProduct[]): ParsedSale {
  const { method, rest } = takeMethod(text);
  const lines: SaleLine[] = [], errors: LineError[] = [];
  const push = (r: ReturnType<typeof matchEntry>) => (r.ok ? lines.push(r.line) : errors.push(r.error));
  for (const row of rest.split(/\n+/).map((s) => s.trim()).filter(Boolean)) {
    const whole = matchEntry(row, products);
    const split = /[,;+]/.test(row);
    // «латте, латте, 2 латте» — повторяющиеся слова значат несколько позиций, а не одно длинное название
    const repeats = (() => { const st = cook(row).name.map(stem); return new Set(st).size < st.length; })();
    if ((whole.ok && !(split && repeats)) || !split) { push(whole); continue; }
    for (const part of row.split(/[,;+]+/).map((s) => s.trim()).filter(Boolean)) push(matchEntry(part, products));
  }
  // одинаковые позиции склеиваем
  const merged = new Map<string, SaleLine>();
  for (const l of lines) {
    const k = `${l.productId}|${[...l.optionIds].sort().join(",")}`;
    const ex = merged.get(k);
    if (ex) ex.quantity += l.quantity; else merged.set(k, { ...l });
  }
  return { method, lines: [...merged.values()], errors };
}
