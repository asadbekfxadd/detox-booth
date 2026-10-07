/**
 * «Мозг» Мандаринки без ИИ: разбирает фразу гостя (русский и узбекский), понимает пожелания
 * (освежиться, сытно, белок, без сахара, бюджет, «без банана», аллергии) и подбирает позиции из меню.
 * Чистые функции: ничего не знают про базу и сеть, поэтому их легко проверять тестами.
 */
export type Lang = "ru" | "uz";

export type MenuItem = {
  id: string; slug: string; name: string; description: string | null; image: string | null;
  category: string; categoryName: string; price: number; optionIds: string[];
  calories: number | null; protein: number | null;
  vegan: boolean; highProtein: boolean; sugarFree: boolean;
  allergens: string[]; ingredients: string[];
};
export type Pick = MenuItem & { why: string };

export type Wishes = {
  categories: string[]; diets: ("protein" | "sugarfree" | "vegan")[];
  keywords: string[]; exclude: string[]; excludeAllergens: string[];
  maxPrice: number | null;
  light: boolean; hearty: boolean; sweet: boolean; fresh: boolean; energy: boolean; cheap: boolean;
  surprise: boolean; more: boolean; allergyMention: boolean;
};
export const emptyWishes = (): Wishes => ({
  categories: [], diets: [], keywords: [], exclude: [], excludeAllergens: [], maxPrice: null,
  light: false, hearty: false, sweet: false, fresh: false, energy: false, cheap: false, surprise: false, more: false, allergyMention: false,
});

export const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[’ʻʼ`´‘]/g, "'");
const has = (t: string, stems: string[]) => stems.some((s) => t.includes(s));

// ---------- словари ----------
const CATEGORY_WORDS: [string, string[]][] = [
  ["smoothies", ["смузи", "smuzi", "smoothie"]],
  ["fresh", ["фреш", "сок", "соки", "лимонад", "sharbat", "fresh"]],
  ["detox", ["детокс", "шот", "detoks", "detox", "shot"]],
  ["bowls", ["боул", "bowl", "боуль"]],
  ["salads", ["салат", "salat"]],
  ["healthy-snacks", ["перекус", "снек", "снэк", "gazak", "snack"]],
  ["fruits", ["фрукт", "meva"]],
  ["sets", ["комбо", "набор", "to'plam", "toplam"]],
];
const SET_WORD = /(^|[^\p{L}])(сет|сеты|сеты|сетик|set|setlar)([^\p{L}]|$)/u;

const DIET_WORDS = {
  protein: ["белок", "белк", "протеин", "протеи", "качал", "тренир", "спорт", "oqsil", "protein", "mashq", "sport"],
  sugarfree: ["без сахар", "безсахар", "несладк", "диабет", "shakarsiz", "qandsiz", "shakar yo'q", "shakarsiz"],
  vegan: ["веган", "растител", "постн", "vegan", "o'simlik"],
};
const LIGHT = ["легк", "похуд", "диет", "мало калор", "низкокал", "не калорий", "yengil", "kam kaloriya", "ozish"];
const HEARTY = ["сытн", "сытное", "голод", "плотн", "пообед", "поесть", "покушать", "наесть", "завтрак", "обед", "ужин", "to'q", "och ", "tushlik", "nonushta", "kechki ovqat", "to'yim"];
const FRESH = ["освеж", "жажд", "жара", "жарко", "холодн", "кисл", "прохлад", "chanqoq", "salqin", "nordon", "ichgim", "issiq"];
const ENERGY = ["бодр", "энерг", "взбодр", "кофе", "устал", "сонн", "quvvat", "energiya", "charchad", "uyqu", "kofe"];
const SWEET = ["слад", "десерт", "shirin", "desert", "ширин"];
const CHEAP = ["дешев", "недорог", "бюджет", "подешевл", "econom", "arzon", "byudjet"];
const SURPRISE = ["удиви", "на твой вкус", "на ваш вкус", "что угодно", "любой", "любое", "сюрприз", "surpriz", "o'zing", "o'zingiz", "tavsiya", "maslahat", "fikr yo'q"];
const MORE = ["друг", "еще", "ещё", "иное", "иной", "ещ ", "boshqa", "yana", "navbat"];
const GREETING = ["привет", "здравств", "добрый", "салам", "хай", "hello", "hi ", "salom", "assalom", "qalaysiz", "hayrli"];
const THANKS = ["спасиб", "благодар", "rahmat", "tashakkur"];
const ALLERGY = ["аллерг", "непереносим", "нельзя", "allergi", "ko'tarolmay", "mumkin emas"];

const ALLERGEN_WORDS: [string, string[]][] = [
  ["milk", ["молок", "лактоз", "сливк", "сыр", "йогурт", "sut", "laktoza", "qaymoq"]],
  ["peanut", ["арахис", "yer yong'oq", "arahis"]],
  ["nuts", ["орех", "миндал", "фундук", "кешью", "yong'oq", "bodom"]],
  ["gluten", ["глютен", "пшениц", "мучн", "овсян", "gluten", "bug'doy"]],
  ["egg", ["яйц", "tuxum"]],
  ["sesame", ["кунжут", "кинз", "kunjut"]],
];

/** Узбекские названия ингредиентов → корень русского слова из меню. */
const UZ_INGREDIENT: Record<string, string> = {
  qulupnay: "клубн", banan: "банан", apelsin: "апельс", olma: "яблок", limon: "лимон", sabzi: "морков", zanjabil: "имбир",
  anor: "гранат", mango: "манго", avokado: "авокад", tarvuz: "арбуз", uzum: "виног", shaftoli: "персик", ananas: "ананас",
  kokos: "кокос", asal: "мед", "yong'oq": "орех", ismaloq: "шпинат", bodring: "огур", yalpiz: "мят", "zerdecho'p": "куркум",
  tovuq: "куриц", kinoa: "киноа", "no'xat": "нут", kivi: "киви", chia: "чиа", yogurt: "йогурт", gilos: "вишн", rezavor: "ягод", mevalar: "фрукт",
};
const STOP = ["хоче", "хочу", "чтоб", "нибуд", "чтото", "что-то", "что-н", "пожал", "посов", "порек", "подск", "выбра", "покаж", "сегод", "сейча",
  "приве", "спаси", "можно", "нужно", "очень", "какой", "какие", "какую", "вкусн", "здрав", "хочется", "хотел", "хотела", "мне", "пожалуйста",
  "бы", "для", "что", "или", "если", "есть", "быть", "этот", "этого", "ваш", "ваше", "вашем", "подбер", "найди", "найти", "порекомендуйте",
  "после", "перед", "когда", "потом", "утром", "вечер", "быстр", "чем-то", "чего-н", "какое", "keyin", "oldin", "ertalab", "kechqurun", "tezda", "больш", "вариан", "чуть", "просто", "немного", "сильно", "ничего", "всё", "menga", "kerak", "bering", "istay", "xohlay", "iltimos", "salom", "rahmat", "qanday", "bor", "yoq", "uchun", "bilan", "juda", "bugun", "hozir", "nima"];

// ---------- разбор фразы ----------
export function detectLang(text: string, fallback: Lang): Lang {
  const t = norm(text);
  const cyr = (t.match(/[\p{Script=Cyrillic}]/gu) ?? []).length;
  const lat = (t.match(/[a-z]/g) ?? []).length;
  if (cyr > lat) return "ru";
  if (lat >= 3 && /(^|[^a-z])(men|menga|bor|yo'q|kerak|qanday|salom|rahmat|shirin|ichimlik|istayman|xohlayman|bering|uchun|bilan|va|yoki|nima|yana|boshqa|arzon|yengil|sovuq|issiq)([^a-z]|$)|siz\b|gacha|oqsil|shakar/.test(t)) return "uz";
  return fallback;
}

function parseBudget(t: string): number | null {
  const NUM = "(\\d{1,3}(?:[\\s.]\\d{3})+|\\d+)";
  const UNIT = "(тыс\\p{L}*|ming\\p{L}*|к(?![\\p{L}])|k(?![\\p{L}]))?";
  const before = new RegExp(`(?:до|не дороже|не больше|дешевле|бюджет|up to|максимум)\\s*${NUM}\\s*${UNIT}`, "u");
  const after = new RegExp(`${NUM}\\s*${UNIT}\\s*(?:сум|сумм|so'm|som|uzs)?\\s*(?:gacha|dan arzon|гача)`, "u");
  const m = before.exec(t) ?? after.exec(t);
  if (!m) return null;
  let n = Number(m[1].replace(/[\s.]/g, ""));
  if (m[2] || n < 1000) n *= 1000;
  return n >= 5000 && n <= 1_000_000 ? n : null;
}

export function parseWishes(raw: string): Wishes {
  const t = ` ${norm(raw)} `;
  const w = emptyWishes();
  for (const [slug, words] of CATEGORY_WORDS) if (has(t, words)) w.categories.push(slug);
  if (SET_WORD.test(t) && !w.categories.includes("sets")) w.categories.push("sets");
  for (const [d, words] of Object.entries(DIET_WORDS)) if (has(t, words)) w.diets.push(d as "protein" | "sugarfree" | "vegan");
  w.light = has(t, LIGHT);
  w.hearty = has(t, HEARTY);
  w.fresh = has(t, FRESH);
  w.energy = has(t, ENERGY);
  w.sweet = has(t, SWEET) && !w.diets.includes("sugarfree");
  w.cheap = has(t, CHEAP);
  w.surprise = has(t, SURPRISE);
  w.more = has(t, MORE);
  w.allergyMention = has(t, ALLERGY);
  w.maxPrice = parseBudget(t);

  const consumed = new Set<string>();
  const mark = (s: string) => s.split(/\s+/).forEach((x) => x && consumed.add(x));

  // аллергены: «аллергия на орехи», «без молока», «nuts siz»
  for (const [code, words] of ALLERGEN_WORDS) {
    const hit = words.find((x) => t.includes(x));
    if (!hit) continue;
    const neg = w.allergyMention || new RegExp(`(без|не люблю|не хочу|кроме|исключ)\\s+\\p{L}*${hit}`, "u").test(t) || new RegExp(`${hit}\\p{L}*\\s*siz`, "u").test(t);
    if (neg) { w.excludeAllergens.push(code); if (code === "nuts") w.excludeAllergens.push("peanut"); }
  }

  // «без X», «не хочу X», «кроме X», «Xsiz»
  for (const m of t.matchAll(/(?:без|не хочу|не люблю|не надо|кроме|исключи|убери)\s+([\p{L}']{3,})/gu)) {
    const word = m[1];
    if (has(` ${m[0]} `, ["без сахар", "без глютен", "без молок", "без лактоз"])) continue;
    w.exclude.push(stem(word)); mark(word);
  }
  for (const m of t.matchAll(/([\p{L}']{3,}?)siz\b/gu)) {
    if (["shakar", "qand"].includes(m[1])) continue;
    w.exclude.push(stem(UZ_INGREDIENT[m[1]] ?? UZ_INGREDIENT[m[1].replace(/[aiou]$/, "")] ?? m[1])); mark(m[0]);
  }

  // остальные значимые слова — ингредиенты и вкусы
  const tokens = t.match(/[\p{L}']+/gu) ?? [];
  const known = [...Object.values(DIET_WORDS).flat(), ...LIGHT, ...HEARTY, ...FRESH, ...ENERGY, ...SWEET, ...CHEAP, ...SURPRISE, ...MORE, ...GREETING, ...THANKS, ...ALLERGY, ...CATEGORY_WORDS.flatMap(([, x]) => x), ...ALLERGEN_WORDS.flatMap(([, x]) => x), ...STOP];
  for (const tok of tokens) {
    if (tok.length < 4 || consumed.has(tok)) continue;
    if (/^(sak|set)/.test(tok) && tok.length < 5) continue;
    if (known.some((k) => k.trim().length >= 3 && (tok.startsWith(k.trim()) || k.trim().startsWith(tok.slice(0, Math.max(4, tok.length - 1)))))) continue;
    const s = UZ_INGREDIENT[tok] ?? stem(tok);
    if (!w.keywords.includes(s) && !w.exclude.includes(s)) w.keywords.push(s);
  }
  // чтобы запросы с категорией «сеты» не считали слово ключом
  w.keywords = w.keywords.filter((k) => !w.categories.some((c) => c.startsWith(k)));
  // «Спасибо большое», «Привет, как дела» — это не пожелания
  const intent = w.categories.length || w.diets.length || w.light || w.hearty || w.fresh || w.energy || w.sweet || w.cheap || w.surprise || w.more || w.maxPrice != null || w.exclude.length || w.excludeAllergens.length;
  if (!intent && (has(t, GREETING) || has(t, THANKS))) w.keywords = [];
  return w;
}
const stem = (word: string) => word.length <= 4 ? word : word.slice(0, Math.max(4, Math.min(word.length - 2, 6)));

export const hasWishes = (w: Wishes) =>
  w.categories.length > 0 || w.diets.length > 0 || w.keywords.length > 0 || w.exclude.length > 0 || w.excludeAllergens.length > 0 ||
  w.maxPrice != null || w.light || w.hearty || w.sweet || w.fresh || w.energy || w.cheap || w.surprise;

/** Складывает пожелания из предыдущих сообщений с новым: категории заменяются, остальное копится. */
export function mergeWishes(prev: Wishes, next: Wishes): Wishes {
  const u = <T,>(a: T[], b: T[]) => [...new Set([...a, ...b])];
  return {
    categories: next.categories.length ? next.categories : prev.categories,
    diets: u(prev.diets, next.diets), keywords: next.keywords.length ? next.keywords : prev.keywords,
    exclude: u(prev.exclude, next.exclude), excludeAllergens: u(prev.excludeAllergens, next.excludeAllergens),
    maxPrice: next.maxPrice ?? prev.maxPrice,
    light: prev.light || next.light, hearty: prev.hearty || next.hearty, sweet: prev.sweet || next.sweet, fresh: prev.fresh || next.fresh,
    energy: prev.energy || next.energy, cheap: prev.cheap || next.cheap, surprise: next.surprise, more: next.more,
    allergyMention: prev.allergyMention || next.allergyMention,
  };
}

export const isGreeting = (raw: string) => { const t = ` ${norm(raw)} `; return has(t, GREETING) || has(t, THANKS); };
export const isThanks = (raw: string) => has(` ${norm(raw)} `, THANKS);

// ---------- подбор ----------
const hay = (p: MenuItem) => norm(`${p.name} ${p.description ?? ""} ${p.ingredients.join(" ")}`);
const nameHay = (p: MenuItem) => norm(p.name);
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 2 ** 32; };

export function scoreItem(p: MenuItem, w: Wishes, maxMenuPrice: number): number {
  const h = hay(p);
  let s = 0;
  if (w.exclude.some((e) => h.includes(e))) return -1000;
  if (w.excludeAllergens.some((a) => p.allergens.includes(a))) return -1000;
  if (w.maxPrice != null && p.price > w.maxPrice) return -1000;
  if (w.categories.length) s += w.categories.includes(p.category) ? 8 : -3;
  for (const d of w.diets) {
    const ok = d === "protein" ? p.highProtein || (p.protein ?? 0) >= 15 : d === "sugarfree" ? p.sugarFree : p.vegan;
    s += ok ? 5 : -5;
  }
  const kcal = p.calories;
  if (w.light && kcal != null) s += kcal <= 200 ? 4 : kcal <= 300 ? 2 : kcal > 450 ? -3 : 0;
  if (w.hearty) { if (kcal != null) s += kcal >= 400 ? 4 : kcal >= 300 ? 2 : kcal < 150 ? -4 : 0; if (["bowls", "sets", "salads"].includes(p.category)) s += 2; }
  if (w.fresh) { if (["fresh", "detox", "fruits"].includes(p.category)) s += 3; if (/лимон|грейпфрут|лайм|ягод|кисл|мят|огур/.test(h)) s += 2; }
  if (w.energy) { if (/имбир|кофе|матча|куркум|грейпфрут|лимон|протеин|банан|финик/.test(h)) s += 2; if (["fresh", "detox"].includes(p.category)) s += 1; }
  if (w.sweet) { if (p.category === "smoothies") s += 2; if (/мед|банан|манго|клубник|ягод|финик|карамел|йогурт|гранол/.test(h)) s += 2; if (p.sugarFree) s -= 1; }
  if (w.cheap) s += (1 - p.price / Math.max(1, maxMenuPrice)) * 5;
  for (const k of w.keywords) { if (h.includes(k)) s += nameHay(p).includes(k) ? 6 : 4; }
  return s;
}

export function pickProducts(menu: MenuItem[], w: Wishes, opts: { shown?: string[]; n?: number; seed?: string } = {}): { items: MenuItem[]; keywordMissed: boolean } {
  const { shown = [], n = 3, seed = "" } = opts;
  const maxPrice = Math.max(...menu.map((p) => p.price), 1);
  let ranked = menu.map((p) => ({ p, s: scoreItem(p, w, maxPrice) + hash(p.slug + seed) * (w.surprise ? 6 : 0.6) })).filter((x) => x.s > -500);
  const keywordMissed = w.keywords.length > 0 && !ranked.some(({ p }) => w.keywords.some((k) => hay(p).includes(k)));
  if (shown.length) { const fresh = ranked.filter((x) => !shown.includes(x.p.slug)); if (fresh.length) ranked = fresh; }
  ranked.sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name));
  // разнообразие: если категорию не просили, не больше двух блюд из одной
  const out: MenuItem[] = [], perCat = new Map<string, number>();
  for (const { p } of ranked) {
    const c = perCat.get(p.category) ?? 0;
    if (!w.categories.length && c >= 2 && ranked.length > n * 2) continue;
    out.push(p); perCat.set(p.category, c + 1);
    if (out.length >= n) break;
  }
  return { items: out, keywordMissed };
}

// ---------- тексты ----------
const num = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n));
export function whyText(p: MenuItem, w: Wishes, lang: Lang): string {
  const parts: string[] = [];
  const L = (ru: string, uz: string) => (lang === "ru" ? ru : uz);
  const matched = w.keywords.find((k) => hay(p).includes(k));
  if (matched) parts.push(L(`есть «${matched}»`, `tarkibida «${matched}» bor`));
  if (w.diets.includes("protein") && (p.highProtein || (p.protein ?? 0) >= 15)) parts.push(L(`белок${p.protein ? ` ${Math.round(p.protein)} г` : ""}`, `oqsil${p.protein ? ` ${Math.round(p.protein)} g` : ""}`));
  if (w.diets.includes("sugarfree") && p.sugarFree) parts.push(L("без сахара", "shakarsiz"));
  if (w.diets.includes("vegan") && p.vegan) parts.push(L("веган", "vegan"));
  if ((w.light || w.hearty) && p.calories != null) parts.push(`${p.calories} ${L("ккал", "kkal")}`);
  if (w.cheap || w.maxPrice != null) parts.push(`${num(p.price)} ${L("сум", "so'm")}`);
  if (!parts.length) { if (p.highProtein) parts.push(L("много белка", "oqsil ko'p")); else if (p.sugarFree) parts.push(L("без сахара", "shakarsiz")); else if (p.calories != null) parts.push(`${p.calories} ${L("ккал", "kkal")}`); }
  return parts.slice(0, 2).join(" · ");
}

export const STARTER_CHIPS: Record<Lang, string[]> = {
  ru: ["Освежиться", "Сытно перекусить", "Белок после тренировки", "Без сахара", "Что-то бодрящее", "Удиви меня"],
  uz: ["Salqinlashtiradigan", "To'yimli taom", "Mashqdan keyin oqsil", "Shakarsiz", "Quvvat beradigan", "Meni hayron qil"],
};
export const GREETING_TEXT: Record<Lang, string> = {
  ru: "Привет! Я Мандаринка 🍊 Помогу выбрать напиток или перекус. Расскажите, что сейчас хочется, или нажмите подсказку.",
  uz: "Salom! Men Mandarinkaman 🍊 Ichimlik yoki gazak tanlashga yordam beraman. Hozir nima xohlayotganingizni yozing yoki maslahatni bosing.",
};

const FOLLOW: Record<Lang, { more: string; light: string; cheap: string; sugarfree: string; protein: string; restart: string }> = {
  ru: { more: "Другие варианты", light: "Полегче", cheap: "Подешевле", sugarfree: "Без сахара", protein: "Больше белка", restart: "Начать заново" },
  uz: { more: "Boshqa variantlar", light: "Yengilroq", cheap: "Arzonroq", sugarfree: "Shakarsiz", protein: "Oqsilroq", restart: "Qaytadan boshlash" },
};

export function followChips(w: Wishes, lang: Lang): string[] {
  const f = FOLLOW[lang];
  const chips = [f.more];
  if (!w.light) chips.push(f.light);
  if (!w.cheap) chips.push(f.cheap);
  if (!w.diets.includes("sugarfree")) chips.push(f.sugarfree);
  else if (!w.diets.includes("protein")) chips.push(f.protein);
  chips.push(f.restart);
  return chips.slice(0, 5);
}

export type RulesReply = { reply: string; picks: Pick[]; chips: string[] };

/** Ответ без ИИ. history — прошлые реплики гостя (для накопления пожеланий), shown — уже показанные slug. */
export function rulesReply(p: { text: string; lang: Lang; history: string[]; shown: string[]; menu: MenuItem[]; seed?: string }): RulesReply {
  const { text, lang, menu } = p;
  const L = (ru: string, uz: string) => (lang === "ru" ? ru : uz);
  const restart = FOLLOW[lang].restart.toLowerCase();
  if (norm(text).trim() === restart || /начать заново|qaytadan/.test(norm(text))) {
    return { reply: GREETING_TEXT[lang], picks: [], chips: STARTER_CHIPS[lang] };
  }
  const fresh = parseWishes(text);
  const prev = p.history.slice(-3).map(parseWishes).reduce(mergeWishes, emptyWishes());
  const w = fresh.more ? mergeWishes(prev, { ...fresh, categories: [], keywords: [] }) : mergeWishes(hasWishes(fresh) ? prev : emptyWishes(), fresh);
  const active = fresh.more ? prev : w;
  if (!hasWishes(w) && !fresh.more) {
    if (isThanks(text)) return { reply: L("Пожалуйста! Если захотите ещё что-нибудь — я рядом 🍊", "Marhamat! Yana nimadir kerak bo'lsa, men shu yerdaman 🍊"), picks: [], chips: STARTER_CHIPS[lang].slice(0, 3) };
    return {
      reply: isGreeting(text) ? GREETING_TEXT[lang] : L("Расскажите, что хочется: освежиться, сытно, много белка, без сахара. Или назовите ингредиент, например «клубника».", "Nima xohlayotganingizni yozing: salqinlashtiradigan, to'yimli, oqsilli, shakarsiz. Yoki masalan «banan» deb ingredient nomini yozing."),
      picks: [], chips: STARTER_CHIPS[lang],
    };
  }
  const wishes = fresh.more ? { ...active, more: true } : w;
  const { items, keywordMissed } = pickProducts(menu, wishes, { shown: p.shown, seed: p.seed });
  if (!items.length) {
    return { reply: L("Под такие пожелания ничего не нашла. Попробуем без части условий?", "Bunday talablarga mos narsa topolmadim. Ba'zi shartlarsiz urinib ko'ramizmi?"), picks: [], chips: [FOLLOW[lang].restart, ...STARTER_CHIPS[lang].slice(0, 3)] };
  }
  const note = wishes.allergyMention ? L(" Я смотрю на отметки аллергенов в меню, но состав обязательно проверьте в карточке.", " Allergenlarni menyudagi belgilar bo'yicha qarayman, lekin tarkibni kartochkada albatta tekshiring.") : "";
  const head = keywordMissed
    ? L("Точно такого нет, но вот близкое по вкусу:", "Aynan shunisi yo'q, lekin mazasi yaqin variantlar:")
    : fresh.more ? L("Вот ещё варианты:", "Mana yana variantlar:") : L("Вот что я бы выбрала:", "Men shularni tanlagan bo'lardim:");
  return { reply: `${head}${note}`, picks: items.map((i) => ({ ...i, why: whyText(i, wishes, lang) })), chips: followChips(wishes, lang) };
}
