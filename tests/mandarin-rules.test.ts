import { describe, it, expect } from "vitest";
import { parseWishes, pickProducts, rulesReply, detectLang, hasWishes, mergeWishes, emptyWishes, type MenuItem } from "@/lib/mandarin/rules";

const mk = (o: Partial<MenuItem> & { slug: string; name: string; category: string }): MenuItem => ({
  id: o.slug, description: "", image: null, categoryName: o.category, price: 30000, optionIds: [], calories: 200, protein: null,
  vegan: false, highProtein: false, sugarFree: false, allergens: [], ingredients: [], ...o,
});
const MENU: MenuItem[] = [
  mk({ slug: "orange", name: "Апельсиновый фреш", category: "fresh", price: 28000, calories: 150, sugarFree: true, vegan: true, description: "Свежевыжатый апельсиновый сок" }),
  mk({ slug: "grapefruit", name: "Грейпфрутовый фреш", category: "fresh", price: 30000, calories: 120, sugarFree: true, vegan: true }),
  mk({ slug: "peanut", name: "Арахис-протеин", category: "smoothies", price: 38000, calories: 360, protein: 25, highProtein: true, allergens: ["milk", "peanut"], description: "Банан, арахисовая паста, протеин и молоко" }),
  mk({ slug: "strawberry", name: "Клубника-банан", category: "smoothies", price: 32000, calories: 240, ingredients: ["Клубника", "Банан"], allergens: ["milk"] }),
  mk({ slug: "mango", name: "Манго-кокос", category: "smoothies", price: 34000, calories: 250, vegan: true, ingredients: ["Манго", "Кокос"] }),
  mk({ slug: "chicken-bowl", name: "Боул с курицей и киноа", category: "bowls", price: 58000, calories: 560, protein: 30, highProtein: true }),
  mk({ slug: "acai-bowl", name: "Боул с асаи", category: "bowls", price: 58000, calories: 430, vegan: true }),
  mk({ slug: "salad", name: "Греческий салат", category: "salads", price: 42000, calories: 280, sugarFree: true, allergens: ["milk"] }),
  mk({ slug: "ginger", name: "Имбирный шот", category: "detox", price: 14000, calories: 25, sugarFree: true, vegan: true, description: "Имбирь, лимон" }),
];

describe("parseWishes", () => {
  it("understands intents in Russian", () => {
    const w = parseWishes("Хочу освежиться, без сахара, до 30 тысяч");
    expect(w.fresh).toBe(true);
    expect(w.diets).toContain("sugarfree");
    expect(w.maxPrice).toBe(30000);
  });
  it("understands budgets in several forms", () => {
    expect(parseWishes("до 30000").maxPrice).toBe(30000);
    expect(parseWishes("до 30к").maxPrice).toBe(30000);
    expect(parseWishes("не дороже 25 000 сум").maxPrice).toBe(25000);
    expect(parseWishes("30 mingga gacha").maxPrice).toBe(30000);
    expect(parseWishes("в 2 раза лучше").maxPrice).toBeNull();
  });
  it("extracts ingredients and exclusions", () => {
    const w = parseWishes("хочу смузи с клубникой, но без банана");
    expect(w.categories).toEqual(["smoothies"]);
    expect(w.keywords).toContain("клубни");
    expect(w.exclude).toContain("бана");
    expect(w.keywords).not.toContain("бана");
  });
  it("handles allergies", () => {
    expect(parseWishes("у меня аллергия на орехи").excludeAllergens).toEqual(expect.arrayContaining(["nuts", "peanut"]));
    expect(parseWishes("без молока").excludeAllergens).toContain("milk");
    expect(parseWishes("аллергия на арахис").allergyMention).toBe(true);
  });
  it("understands Uzbek", () => {
    const w = parseWishes("Menga shakarsiz va yengil ichimlik kerak");
    expect(w.diets).toContain("sugarfree");
    expect(w.light).toBe(true);
    expect(parseWishes("bananasiz smuzi").exclude).toContain("бана");
    expect(parseWishes("qulupnay bor?").keywords).toContain("клубн");
  });
  it("service words are not ingredients", () => {
    const w = parseWishes("Белок после тренировки");
    expect(w.keywords).toEqual([]);
    expect(w.diets).toContain("protein");
    expect(parseWishes("что-нибудь быстро перед работой").keywords).toEqual(["работ"]);
  });
  it("greeting has no wishes", () => {
    expect(hasWishes(parseWishes("Привет"))).toBe(false);
    expect(hasWishes(parseWishes("Salom"))).toBe(false);
    expect(hasWishes(parseWishes("спасибо большое"))).toBe(false);
  });
});

describe("detectLang", () => {
  it("detects Russian and Uzbek", () => {
    expect(detectLang("хочу сок", "uz")).toBe("ru");
    expect(detectLang("menga shirin ichimlik kerak", "ru")).toBe("uz");
    expect(detectLang("ok", "ru")).toBe("ru");
  });
});

describe("pickProducts", () => {
  it("prefers protein for training", () => {
    const { items } = pickProducts(MENU, parseWishes("белок после тренировки"));
    expect(items[0].slug === "peanut" || items[0].slug === "chicken-bowl").toBe(true);
    expect(items.every((p) => p.highProtein) || items.some((p) => p.highProtein)).toBe(true);
  });
  it("respects exclusions, allergens and budget", () => {
    expect(pickProducts(MENU, parseWishes("смузи без банана")).items.map((p) => p.slug)).not.toContain("strawberry");
    expect(pickProducts(MENU, parseWishes("аллергия на арахис, смузи")).items.map((p) => p.slug)).not.toContain("peanut");
    const cheap = pickProducts(MENU, parseWishes("что-нибудь до 30000"));
    expect(cheap.items.every((p) => p.price <= 30000)).toBe(true);
  });
  it("finds by ingredient and reports misses", () => {
    expect(pickProducts(MENU, parseWishes("с манго")).items[0].slug).toBe("mango");
    expect(pickProducts(MENU, parseWishes("хочу киви")).keywordMissed).toBe(true);
  });
  it("hearty prefers bowls and high calories", () => {
    const top = pickProducts(MENU, parseWishes("хочу сытно поесть")).items.map((p) => p.slug);
    expect(top[0]).toBe("chicken-bowl");
  });
  it("does not repeat shown items", () => {
    const first = pickProducts(MENU, parseWishes("освежиться")).items.map((p) => p.slug);
    const more = pickProducts(MENU, parseWishes("освежиться"), { shown: first }).items.map((p) => p.slug);
    expect(more.some((s) => first.includes(s)) && more.length === first.length && first.length >= MENU.length).toBe(false);
    expect(more.filter((s) => first.includes(s)).length).toBeLessThan(first.length);
  });
});

describe("rulesReply", () => {
  it("answers a greeting with chips", () => {
    const r = rulesReply({ text: "Привет", lang: "ru", history: [], shown: [], menu: MENU });
    expect(r.picks).toHaveLength(0);
    expect(r.chips.length).toBeGreaterThan(3);
  });
  it("recommends and offers follow-ups", () => {
    const r = rulesReply({ text: "без сахара и освежиться", lang: "ru", history: [], shown: [], menu: MENU });
    expect(r.picks.length).toBeGreaterThan(0);
    expect(r.picks.every((p) => p.sugarFree)).toBe(true);
    expect(r.chips).toContain("Другие варианты");
    expect(r.picks[0].why).toBeTruthy();
  });
  it("accumulates wishes: 'lighter' after 'refresh'", () => {
    const r = rulesReply({ text: "Полегче", lang: "ru", history: ["освежиться"], shown: ["orange"], menu: MENU });
    expect(r.picks.length).toBeGreaterThan(0);
    expect(r.picks.map((p) => p.slug)).not.toContain("orange");
  });
  it("'more' keeps the previous wishes", () => {
    const r1 = rulesReply({ text: "хочу смузи", lang: "ru", history: [], shown: [], menu: MENU });
    const r2 = rulesReply({ text: "Другие варианты", lang: "ru", history: ["хочу смузи"], shown: r1.picks.map((p) => p.slug), menu: MENU });
    expect(r2.picks.map((p) => p.slug).filter((x) => r1.picks.map((q) => q.slug).includes(x))).toHaveLength(0);
    expect(r2.reply).toMatch(/ещё/);
  });
  it("answers in Uzbek", () => {
    const r = rulesReply({ text: "shakarsiz ichimlik", lang: "uz", history: [], shown: [], menu: MENU });
    expect(r.reply).toMatch(/tanlagan|yo'q|variant/);
    expect(r.picks.length).toBeGreaterThan(0);
  });
  it("adds an allergy warning", () => {
    const r = rulesReply({ text: "аллергия на молоко", lang: "ru", history: [], shown: [], menu: MENU });
    expect(r.reply).toMatch(/аллерген/);
    expect(r.picks.every((p) => !p.allergens.includes("milk"))).toBe(true);
  });
  it("says so when nothing fits", () => {
    const r = rulesReply({ text: "веган до 10000", lang: "ru", history: [], shown: [], menu: MENU });
    expect(r.picks).toHaveLength(0);
    expect(r.reply).toMatch(/ничего не нашла/);
  });
  it("merge keeps categories replaced", () => {
    const a = { ...emptyWishes(), categories: ["fresh"], light: true };
    const b = { ...emptyWishes(), categories: ["bowls"] };
    expect(mergeWishes(a, b).categories).toEqual(["bowls"]);
    expect(mergeWishes(a, b).light).toBe(true);
  });
});
