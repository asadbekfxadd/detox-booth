/**
 * Продукт из текстового описания. Человек пишет как удобно:
 *   Яблочный фреш: яблоко 300 г, морковь 150 г, лимон 20 г. Размеры 300 и 500 мл, цена 25000 и 38000
 * Здесь чистые функции (без базы): разбор текста, подбор ингредиентов склада, категории, описание и пересчёт граммов по размерам.
 */

export type Unit = "G" | "ML" | "PC";
export type DraftIngredient = { name: string; quantity: number; unit: Unit };
export type DraftSize = { name: string; ml: number | null; price: number | null };
export type Draft = { name: string; sizes: DraftSize[]; ingredients: DraftIngredient[]; warnings: string[] };

const ALPHA = "a-zа-яёўқғҳ";
const NUM = "\\d+(?:\\.\\d+)?";
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lowerE = (s: string) => s.toLowerCase().replace(/ё/g, "е");

/** Приводит текст к виду, который проще разбирать: десятичные точки, тысячи, «25к», пробелы */
export function normalizeText(raw: string): string {
  let t = raw.replace(/ /g, " ").replace(/[«»"“”]/g, '"').replace(/\r/g, "");
  t = t.replace(/(\d),(\d)/g, "$1.$2"); // 0,5 л
  const joinK = (s: string) => s.replace(/[ ]/g, "");
  t = t.replace(/(\d{1,3}(?: \d{3})+)(\s*(?:сум|сўм|uzs|so'?m))/gi, (_m, n, c) => joinK(n) + c);
  t = t.replace(/(цен[аы]?:?\s*)(\d{1,3}(?: \d{3})+)/gi, (_m, p, n) => p + joinK(n));
  t = t.replace(/(\d+(?:\.\d+)?)\s*[кk](?![а-яa-zё])/gi, (_m, n) => String(Math.round(Number(n) * 1000))); // 25к → 25000
  return t;
}

const UNIT_RE = "(?:кг|килограмм[а-яё]*|гр|грамм[а-яё]*|г|мл|миллилитр[а-яё]*|л|литр[а-яё]*|шт|штук[а-яё]*)";
const SIZE_WORD = /^(?:размер[а-яё]*|объ[её]м[а-яё]*|порци[а-яё]*)$/i;
const FILLER = /^(?:добавить|добавляю|добавил|добавляем|плюс|ещё|еще|около|примерно|состав|ингредиенты|рецепт|на порцию|порция|берём|берем)$/i;

function toBase(qty: number, unitRaw: string): { quantity: number; unit: Unit } {
  const u = unitRaw.toLowerCase();
  if (u.startsWith("кг") || u.startsWith("килограмм")) return { quantity: qty * 1000, unit: "G" };
  if (u === "г" || u.startsWith("гр")) return { quantity: qty, unit: "G" };
  if (u === "мл" || u.startsWith("миллилитр")) return { quantity: qty, unit: "ML" };
  if (u === "л" || u.startsWith("литр")) return { quantity: qty * 1000, unit: "ML" };
  return { quantity: qty, unit: "PC" };
}

const sizeLabel = (ml: number) => (ml >= 1000 && ml % 1000 === 0 ? `${ml / 1000} л` : `${ml} мл`);
const mlFrom = (n: string, u: string) => Math.round(/^л/i.test(u) ? Number(n) * 1000 : Number(n));

export function parseDraft(raw: string): Draft {
  const warnings: string[] = [];
  let text = normalizeText(raw);
  const sizes: DraftSize[] = [];
  const prices: number[] = [];
  const addSize = (ml: number, price: number | null = null) => {
    if (!ml || ml < 20 || ml > 5000) return;
    if (!sizes.some((s) => s.ml === ml)) sizes.push({ name: sizeLabel(ml), ml, price });
    else if (price != null) { const s = sizes.find((x) => x.ml === ml)!; if (s.price == null) s.price = price; }
  };

  // 1) списки объёмов: «размеры 300 и 500 мл», «300/500 мл», «объём: 250, 400 мл»
  const listRe = new RegExp(`(?:(?:размер[а-яё]*|объ[её]м[а-яё]*|порци[а-яё]*)\\s*[:\\-—]?\\s*)?(${NUM}(?:\\s*(?:мл|л))?(?:\\s*(?:/|,|и|или|\\+|;)\\s*${NUM}(?:\\s*(?:мл|л))?)+)\\s*(мл|л)(?![а-яa-zё])`, "gi");
  text = text.replace(listRe, (_m, list: string, unit: string) => {
    for (const part of list.split(/\s*(?:\/|,|и|или|\+|;)\s*/i)) {
      const mm = new RegExp(`^(${NUM})\\s*(мл|л)?$`, "i").exec(part.trim());
      if (mm) addSize(mlFrom(mm[1], mm[2] ?? unit));
    }
    return " ";
  });

  // 2) цена: «цена 25000», «цены 25000 и 38000», «25000 сум»
  text = text.replace(new RegExp(`цен[аы]?\\s*[:\\-—]?\\s*(${NUM}(?:\\s*(?:/|,|и|или)\\s*${NUM})*)(?:\\s*(?:сум|сўм|uzs|so'?m))?`, "gi"), (_m, list: string) => {
    for (const n of list.split(/\s*(?:\/|,|и|или)\s*/i)) if (Number(n) > 0) prices.push(Math.round(Number(n)));
    return " ";
  });

  // 3) сегменты: строки, «;», «, », точки-предложения, « и », « + »
  const segs: string[] = [];
  for (const line of text.split(/\n+/)) {
    for (const s1 of line.split(/;|,\s*|\.\s+|\s+\+\s+/)) {
      // «яблоко 300 г и морковь 150 г»
      for (const s2 of s1.split(/\s+и\s+(?=[^,;]*\d)/i)) { const t = s2.trim(); if (t) segs.push(t); }
    }
  }

  let name = "";
  const ingredients: DraftIngredient[] = [];
  const fwd = new RegExp(`^([${ALPHA}][${ALPHA}\\s\\-.'"]*?)\\s*[:=\\-—–]?\\s*(${NUM})\\s*(${UNIT_RE})\\.?$`, "i");
  const rev = new RegExp(`^(${NUM})\\s*(${UNIT_RE})\\.?\\s+(?:из\\s+|of\\s+)?([${ALPHA}][${ALPHA}\\s\\-'"]*)$`, "i");
  const sizePrice = new RegExp(`^(?:размер[а-яё]*|объ[её]м[а-яё]*)?\\s*[:\\-—]?\\s*(${NUM})\\s*(мл|л)\\s*[:=\\-—–]?\\s*(?:по\\s*)?(\\d+)\\s*(?:сум|сўм|uzs|so'?m)?$`, "i");
  const sizeOnly = new RegExp(`^(?:размер[а-яё]*|объ[её]м[а-яё]*|порци[а-яё]*)?\\s*[:\\-—]?\\s*(${NUM})\\s*(мл|л)$`, "i");
  const priceOnly = new RegExp(`^(\\d+)\\s*(?:сум|сўм|uzs|so'?m)$`, "i");

  const clean = (n: string) => {
    const words = n.replace(/\s+/g, " ").replace(/[.:'"-]+$/g, "").trim().split(" ").filter((w) => w && !FILLER.test(w) && !/^(?:из|с|со|на|по)$/i.test(w));
    return words.join(" ");
  };
  const take = (seg: string): boolean => {
    let m: RegExpExecArray | null;
    if ((m = sizePrice.exec(seg)) && Number(m[3]) >= 100) { addSize(mlFrom(m[1], m[2]), Number(m[3])); return true; }
    if ((m = sizeOnly.exec(seg))) { addSize(mlFrom(m[1], m[2])); return true; }
    if ((m = priceOnly.exec(seg))) { prices.push(Number(m[1])); return true; }
    if ((m = fwd.exec(seg))) {
      const nm = clean(m[1]);
      if (nm.length >= 2 && !SIZE_WORD.test(nm)) { const b = toBase(Number(m[2]), m[3]); ingredients.push({ name: cap(nm.toLowerCase()), ...b }); return true; }
    }
    if ((m = rev.exec(seg))) {
      const nm = clean(m[3]);
      if (nm.length >= 2) { const b = toBase(Number(m[1]), m[2]); ingredients.push({ name: cap(nm.toLowerCase()), ...b }); return true; }
    }
    return false;
  };

  for (const seg of segs) {
    if (take(seg)) continue;
    // «Яблочный фреш: яблоко 300 г» — название перед двоеточием
    const colon = /^([^:]+):\s*(.+)$/.exec(seg);
    if (colon && !/\d/.test(colon[1]) && !name) { name = clean(colon[1]); if (!take(colon[2].trim())) warnings.push(`Не поняла: «${colon[2].trim()}»`); continue; }
    if (!name && !/\d/.test(seg)) { name = clean(seg); continue; }
    if (/\d/.test(seg)) warnings.push(`Не поняла: «${seg}»`);
  }
  name = cap(name.replace(/^(?:новый|новая|новое)\s+/i, ""));

  // цены раскладываем по размерам (по возрастанию объёма)
  sizes.sort((a, b) => (a.ml ?? 0) - (b.ml ?? 0));
  const ps = [...prices].sort((a, b) => a - b);
  const unpriced = sizes.filter((s) => s.price == null);
  if (!sizes.length && ps.length) sizes.push({ name: "Стандарт", ml: null, price: ps[0] });
  else if (ps.length && unpriced.length) {
    if (ps.length >= unpriced.length) unpriced.forEach((s, i) => { s.price = ps[i]; });
    else {
      // одна цена на несколько размеров: считаем пропорционально объёму от самого малого
      const first = unpriced[0];
      first.price = ps[0];
      for (const s of unpriced.slice(1)) s.price = first.ml && s.ml ? Math.round((ps[0] * s.ml) / first.ml / 500) * 500 : ps[0];
      warnings.push("Цена указана одна на несколько размеров. Остальные посчитала пропорционально объёму, проверьте.");
    }
  } else if (!sizes.length) sizes.push({ name: "Стандарт", ml: null, price: null });
  return { name, sizes, ingredients, warnings };
}

// ---- подбор ингредиентов склада ----

/** Основа слова без окончания: яблоко/яблока/яблок → «яблок», морковь/моркови → «морков» */
export function stem(word: string): string {
  const w = lowerE(word);
  return w.replace(/(ами|ями|ого|ему|ому|ыми|ими|ов|ев|ей|ых|их|ым|им|ой|ый|ий|ая|яя|ое|ее|ую|юю|а|я|о|е|ы|и|у|ю|ь|й)$/, "");
}
const wordsOf = (s: string) => lowerE(s).split(/[^a-zа-яўқғҳ0-9]+/).filter((w) => w.length > 1);
const stemMatch = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Совпали ли названия по основам слов (яблока = Яблоко); иначе совпадение приблизительное и о нём стоит предупредить. */
export function sameIngredient(a: string, b: string): boolean {
  const wa = wordsOf(a).map(stem), wb = wordsOf(b).map(stem);
  return wa.length === wb.length && wa.every((w, i) => stemMatch(w, wb[i]));
}

export type StockIngredient = { id: string; name: string; unit: string; pieceWeightG: number | null };
/** Ищет ингредиент склада по названию: точное совпадение, потом по основам слов (все слова названия совпали). */
export function matchIngredient<T extends { name: string }>(name: string, list: T[]): T | null {
  const key = lowerE(name).trim();
  const exact = list.find((i) => lowerE(i.name).trim() === key);
  if (exact) return exact;
  const ws = wordsOf(name).map(stem);
  if (!ws.length) return null;
  let best: { it: T; score: number } | null = null;
  for (const it of list) {
    const iw = wordsOf(it.name).map(stem);
    if (!iw.length) continue;
    const hit = ws.every((w) => iw.some((x) => stemMatch(w, x)));
    const back = iw.every((x) => ws.some((w) => stemMatch(w, x)));
    if (hit || back) { const score = (hit ? 1 : 0) + (back ? 1 : 0) - Math.abs(iw.length - ws.length) * 0.1; if (!best || score > best.score) best = { it, score }; }
  }
  return best?.it ?? null;
}

/** Количество в единице ингредиента склада: «шт» в граммы по весу штуки, мл и г считаем 1:1 с предупреждением. */
export function alignQuantity(d: DraftIngredient, stockUnit: string, pieceWeightG: number | null): { quantity: number; warning?: string } {
  const su = stockUnit === "KG" ? "G" : stockUnit === "L" ? "ML" : stockUnit;
  if (su === d.unit) return { quantity: d.quantity };
  if (d.unit === "PC" && su === "G" && pieceWeightG) return { quantity: Math.round(d.quantity * pieceWeightG * 10) / 10 };
  if ((d.unit === "G" && su === "ML") || (d.unit === "ML" && su === "G")) return { quantity: d.quantity, warning: `«${d.name}»: на складе другая единица, посчитала 1 г = 1 мл. Проверьте.` };
  return { quantity: 0, warning: `«${d.name}»: на складе считается в ${su === "PC" ? "штуках" : su === "G" ? "граммах" : "миллилитрах"}, а в описании другая единица. Укажите количество в рецепте.` };
}

// ---- размеры: граммы пропорционально объёму ----

/** Граммы из описания относятся к первому (самому малому) размеру; на остальные пересчитываем по объёму. */
export function scaleFor(sizes: DraftSize[], i: number): number {
  const ref = sizes[0];
  const s = sizes[i];
  return ref?.ml && s?.ml ? s.ml / ref.ml : 1;
}
export function scaleQty(q: number, k: number, unit: Unit | string): number {
  const v = q * k;
  return unit === "PC" ? Math.round(v * 100) / 100 : v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
}

// ---- категория и описание ----

const KINDS: { re: RegExp; cat: RegExp; noun: string }[] = [
  { re: /фреш|свежевыжат/i, cat: /фреш|сок/i, noun: "Свежевыжатый фреш" },
  { re: /смузи/i, cat: /смузи/i, noun: "Смузи" },
  { re: /\bсок\b|сока|соки/i, cat: /сок|фреш/i, noun: "Сок" },
  { re: /шот/i, cat: /шот/i, noun: "Шот" },
  { re: /детокс/i, cat: /детокс/i, noun: "Детокс-напиток" },
  { re: /лимонад/i, cat: /лимонад|напит/i, noun: "Лимонад" },
  { re: /коктейл/i, cat: /коктейл|напит/i, noun: "Коктейль" },
  { re: /салат/i, cat: /салат/i, noun: "Салат" },
  { re: /боул|bowl/i, cat: /боул|bowl/i, noun: "Боул" },
  { re: /десерт|торт|чизкейк/i, cat: /десерт/i, noun: "Десерт" },
  { re: /чай/i, cat: /чай/i, noun: "Чай" },
  { re: /кофе/i, cat: /кофе/i, noun: "Кофе" },
];

export function guessCategory<C extends { id: string; name: string }>(name: string, categories: C[]): C | null {
  const n = lowerE(name);
  for (const k of KINDS) if (k.re.test(n)) { const c = categories.find((c) => k.cat.test(lowerE(c.name))); if (c) return c; }
  for (const c of categories) { const st = wordsOf(c.name).map(stem).filter((w) => w.length >= 4); if (st.some((w) => n.includes(w))) return c; }
  return null;
}

/** Короткое описание для карточки по названию и составу. Не обещает того, чего не знает (калории, vegan и т.п.). */
export function describeProduct(name: string, ingredientNames: string[]): string {
  const kind = KINDS.find((k) => k.re.test(lowerE(name)));
  const list = [...new Set(ingredientNames.map((n) => lowerE(n)))].filter((n) => !/стакан|крышк|трубочк|упаков/.test(n));
  const head = kind ? `${kind.noun}.` : "";
  const body = list.length ? `Состав: ${list.join(", ")}.` : "";
  const tail = kind && /фреш|сок|смузи|шот/.test(kind.noun.toLowerCase()) ? " Готовим свежим по заказу." : " Готовим по заказу.";
  return [head, body].filter(Boolean).join(" ").concat(tail).trim().slice(0, 500);
}
