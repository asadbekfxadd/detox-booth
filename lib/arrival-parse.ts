import { normalize, sim, words } from "@/lib/sale-parse";

/**
 * Разбор прихода (поступления на склад), записанного текстом в боте:
 *   Морковка 50 кг 6000 сум
 *   Имбирь 30.000 сум кг
 *   Тыква 33кг по 3000 кг
 *   Зелень 15000
 *   Общий: 564.000 сум
 * Цена — за единицу (за кг, за шт). Строка «Общий» нужна для сверки: если сумма по строкам не сходится, бот ничего не записывает.
 * Чистые функции без базы, список ингредиентов приходит параметром.
 */
export type IngUnit = "G" | "KG" | "ML" | "L" | "PC";
export type MatchIngredient = { id: string; name: string; unit: IngUnit; avgCost: number };

export type ArrivalLine = { ingredientId: string; name: string; unit: IngUnit; quantity: number; unitCost: number; total: number; guessedPrice: boolean };
export type ArrivalError = { raw: string; reason: "unknown" | "ambiguous" | "unit" | "unclear"; candidates?: string[] };
export type ParsedArrival = { lines: ArrivalLine[]; errors: ArrivalError[]; claimedTotal: number | null; sum: number; mismatch: boolean; locationNo: number | null };

export const UNIT_RU: Record<IngUnit, string> = { G: "г", KG: "кг", ML: "мл", L: "л", PC: "шт" };

const UNIT_WORDS: Record<string, IngUnit> = {
  кг: "KG", килограмм: "KG", килограмма: "KG", kg: "KG",
  г: "G", гр: "G", грамм: "G", грамма: "G", g: "G",
  л: "L", литр: "L", литра: "L", литров: "L", l: "L",
  мл: "ML", ml: "ML",
  шт: "PC", штук: "PC", штуки: "PC", штука: "PC", пучок: "PC", пучка: "PC", пачка: "PC", пачки: "PC", упаковка: "PC", уп: "PC",
};
const SUM_WORDS = new Set(["сум", "сумов", "сума", "som", "uzs", "сўм"]);
const NOISE = new Set(["по", "за", "x", "х", "и", "руб"]);
const START = /^\s*(приход|закупка|закупил[аи]?|привезли|привёз|поставка)(?![а-яa-z])[\s:.\-–—]*/i;
const TOTAL = /^(общий|общая|общее|итого|всего|сумма|total)(?![а-яa-z])[^\d\n]*([\d][\d.,\s]*)/;

/** Это приход? Явное слово в начале или строка «Общий/Итого: сумма» (в продажах такой строки не бывает) */
export function isArrivalText(raw: string): boolean {
  const t = normalize(raw).trim();
  if (START.test(t)) return true;
  return t.split(/\n/).some((l) => TOTAL.test(l.trim()));
}

/** Число из текста. Деньги: «30.000» = 30000. Количество: «1.500 кг» = 1,5 кг. */
export function amount(tok: string, kind: "money" | "qty"): number | null {
  if (!/^\d+(?:[.,]\d+)*$/.test(tok)) return null;
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(tok) && (kind === "money" || /^\d{1,3}(?:[.,]\d{3}){2,}$/.test(tok))) return Number(tok.replace(/[.,]/g, ""));
  if (/^\d+(?:[.,]\d+)?$/.test(tok)) return Number(tok.replace(",", "."));
  return null;
}

const factor = (from: IngUnit, to: IngUnit): number | null => {
  if (from === to) return 1;
  if (from === "KG" && to === "G") return 1000; if (from === "G" && to === "KG") return 0.001;
  if (from === "L" && to === "ML") return 1000; if (from === "ML" && to === "L") return 0.001;
  return null;
};

type Raw = { raw: string; name: string[]; qty: number | null; unit: IngUnit | null; price: number | null };

function cook(entry: string): Raw | { raw: string; bad: true } {
  const raw = entry.trim();
  const toks = normalize(entry).replace(/(\d)(кг|гр|г|л|мл|шт|kg|ml)(?![a-zа-я])/g, "$1 $2").replace(/[:=×*]/g, " ").split(/\s+/).map((t) => t.replace(/^[.,\-–—]+|[.,]+$/g, "")).filter(Boolean);
  const nums: { v: string; unitAfter: IngUnit | null; sumAfter: boolean; poBefore: boolean; at: number }[] = [];
  const name: string[] = [];
  let standalone: IngUnit | null = null;
  const used = new Set<number>();
  toks.forEach((t, i) => {
    if (/^\d+(?:[.,]\d+)*$/.test(t)) {
      const n = toks[i + 1] ?? "";
      nums.push({ v: t, unitAfter: UNIT_WORDS[n] ?? null, sumAfter: SUM_WORDS.has(n), poBefore: toks[i - 1] === "по" || toks[i - 1] === "за", at: i });
      if (UNIT_WORDS[n]) used.add(i + 1);
      return;
    }
  });
  toks.forEach((t, i) => {
    if (/^\d+(?:[.,]\d+)*$/.test(t) || SUM_WORDS.has(t) || NOISE.has(t)) return;
    if (t in UNIT_WORDS) { if (!used.has(i)) standalone = UNIT_WORDS[t]; return; }
    name.push(t);
  });
  const priceN = nums.filter((n) => n.sumAfter || n.poBefore);
  const qtyN = nums.filter((n) => !priceN.includes(n) && n.unitAfter);
  const other = nums.filter((n) => !priceN.includes(n) && !qtyN.includes(n));
  if (priceN.length > 1 || qtyN.length > 1 || other.length > 2 || !name.length) return { raw, bad: true };
  let qty: number | null = null, unit: IngUnit | null = standalone, price: number | null = null;
  if (qtyN[0]) { qty = amount(qtyN[0].v, "qty"); unit = qtyN[0].unitAfter; }
  if (priceN[0]) price = amount(priceN[0].v, "money");
  if (qtyN[0] && priceN[0]) { /* всё названо явно */ }
  else if (qtyN[0]) { if (other.length === 1) price = amount(other[0].v, "money"); else if (other.length > 1) return { raw, bad: true }; }
  else if (priceN[0]) { if (other.length === 1) qty = amount(other[0].v, "qty"); else if (other.length > 1) return { raw, bad: true }; }
  else if (other.length === 1) price = amount(other[0].v, "money");
  else if (other.length === 2) { qty = amount(other[0].v, "qty"); price = amount(other[1].v, "money"); }
  if ((nums.length && qty == null && price == null) || (qty != null && qty <= 0) || (price != null && price < 0)) return { raw, bad: true };
  return { raw, name, qty, unit, price };
}

type Cand = { ing: MatchIngredient; score: number };
function findIngredient(q: string[], ings: MatchIngredient[]): { ing: MatchIngredient } | { error: "unknown" | "ambiguous"; candidates?: string[] } {
  const cands: Cand[] = [];
  for (const ing of ings) {
    const w = words(ing.name);
    if (!w.length) continue;
    let sumSim = 0, ok = true; const hit = new Set<number>();
    for (const word of q) {
      let best = 0, bi = -1;
      w.forEach((x, i) => { const s = sim(word, x); if (s > best) { best = s; bi = i; } });
      if (best === 0) { ok = false; break; }
      sumSim += best; hit.add(bi);
    }
    if (!ok) continue;
    cands.push({ ing, score: (sumSim / q.length) * 0.6 + (hit.size / w.length) * 0.4 });
  }
  if (!cands.length) return { error: "unknown" };
  cands.sort((a, b) => b.score - a.score);
  const near = cands.filter((c) => cands[0].score - c.score < 0.04);
  if (near.length > 1) return { error: "ambiguous", candidates: near.slice(0, 4).map((c) => c.ing.name) };
  return { ing: cands[0].ing };
}

export function parseArrival(text: string, ings: MatchIngredient[]): ParsedArrival {
  let claimedTotal: number | null = null;
  let locationNo: number | null = null;
  const body = normalize(text).replace(/(?:^|\s)точка\s+(\d+)\b/g, (_, n) => { locationNo = Number(n); return " "; });
  const rows = body.split(/\n|;/).map((r) => r.trim()).filter(Boolean);
  rows[0] = (rows[0] ?? "").replace(START, "").trim();

  type Item = { ing: MatchIngredient; qty: number; price: number | null; unitFactor: number };
  const items: Item[] = [];
  const errors: ArrivalError[] = [];
  for (const row of rows) {
    if (!row) continue;
    const tot = TOTAL.exec(row);
    if (tot) { claimedTotal = amount(tot[2].trim().replace(/\s+/g, "").replace(/[.,]$/, ""), "money"); continue; }
    const c = cook(row);
    if ("bad" in c) { errors.push({ raw: c.raw, reason: "unclear" }); continue; }
    const f = findIngredient(c.name, ings);
    if ("error" in f) { errors.push({ raw: c.raw, reason: f.error, candidates: f.candidates }); continue; }
    const fac = c.unit ? factor(c.unit, f.ing.unit) : 1;
    if (fac == null) { errors.push({ raw: c.raw, reason: "unit", candidates: [UNIT_RU[f.ing.unit]] }); continue; }
    items.push({ ing: f.ing, qty: (c.qty ?? 1) * fac, price: c.price == null ? null : c.price / fac, unitFactor: fac });
  }

  // цена в строке — за единицу; если «Общий» с этим не сходится, а с ценой «за всю строку» сходится, берём второй вариант
  const sumFor = (mode: "unit" | "line") => items.reduce((a, i) => a + (i.price == null ? i.ing.avgCost * i.qty : mode === "unit" ? i.price * i.qty : i.price * i.unitFactor), 0);
  let mode: "unit" | "line" = "unit";
  let sum = sumFor("unit");
  let mismatch = false;
  if (claimedTotal != null && items.length) {
    if (Math.abs(sum - claimedTotal) > 1) {
      const alt = sumFor("line");
      if (Math.abs(alt - claimedTotal) <= 1) { mode = "line"; sum = alt; } else mismatch = true;
    }
  }
  const merged = new Map<string, ArrivalLine>();
  for (const i of items) {
    const guessed = i.price == null;
    const unitCost = guessed ? i.ing.avgCost : mode === "unit" ? i.price! : (i.price! * i.unitFactor) / i.qty;
    const total = unitCost * i.qty;
    const ex = merged.get(i.ing.id);
    if (ex) { ex.quantity += i.qty; ex.total += total; ex.unitCost = ex.total / ex.quantity; ex.guessedPrice ||= guessed; }
    else merged.set(i.ing.id, { ingredientId: i.ing.id, name: i.ing.name, unit: i.ing.unit, quantity: i.qty, unitCost, total, guessedPrice: guessed });
  }
  const lines = [...merged.values()].map((l) => ({ ...l, unitCost: Math.round(l.unitCost * 100) / 100, total: Math.round(l.total) }));
  return { lines, errors, claimedTotal, sum: Math.round(sum), mismatch, locationNo };
}
