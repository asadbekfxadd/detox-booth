import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadRules } from "@/services/happy-hour";
import { priceAt, type HappyRule } from "@/lib/happy-hour";
import { usableStock } from "@/services/availability";
import { promotionsForCart, type Applied, type Hint } from "@/services/promotions";
import { pairStats } from "@/services/upsell";
import { buildAdvice, type Advice, type MenuLite, type UpsellPick } from "@/lib/upsell";

export type PublicOption = { id: string; name: string; priceDelta: number };
export type PublicModifier = { id: string; name: string; multiple: boolean; required: boolean; options: PublicOption[] };
export type PublicProduct = {
  id: string; slug: string; name: string; description: string | null; image: string | null;
  price: number; defaultPrice: number; defaultOptionIds: string[];
  /** Счастливые часы: скидка в %, и цена без скидки (для зачёркивания). 0 и null — акции сейчас нет. */
  happyPct: number; oldDefaultPrice: number | null;
  category: { id: string; name: string; slug: string };
  calories: number | null; protein: number | null; carbs: number | null; fat: number | null;
  volumeMl: number | null; prepMinutes: number; allergens: string[]; ingredients: string[];
  isVegan: boolean; isHighProtein: boolean; isSugarFree: boolean;
  available: boolean; portions: number | null; modifiers: PublicModifier[];
};

const productInclude = {
  category: true,
  recipe: { include: { items: { include: { ingredient: { select: { name: true, category: true } } } } } },
  modifiers: { include: { options: { orderBy: [{ priceDelta: "asc" }, { name: "asc" }] } } },
} satisfies Prisma.ProductInclude;
type Row = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toPublic(p: Row, stock: Map<string, Prisma.Decimal>, rules: HappyRule[] = []): PublicProduct {
  const items = p.recipe?.items ?? [];
  const portions = items.length
    ? Math.max(0, Math.min(...items.map((i) => Math.floor(Number(stock.get(i.ingredientId) ?? 0) / Number(i.quantity)))))
    : null;
  const modifiers = p.modifiers.map((m) => ({
    id: m.id, name: m.name, multiple: m.multiple, required: m.required,
    options: m.options.map((o) => ({ id: o.id, name: o.name, priceDelta: Number(o.priceDelta) })),
  }));
  const defaults = modifiers.filter((m) => m.required && !m.multiple && m.options.length).map((m) => m.options[0]);
  const base = Number(p.price);
  const hp = priceAt(rules, p.categoryId, base, Date.now());
  const price = hp.price;
  const optSum = defaults.reduce((a, o) => a + o.priceDelta, 0);
  return {
    id: p.id, slug: p.slug, name: p.name, description: p.description, image: p.image,
    price, defaultPrice: price + optSum, defaultOptionIds: defaults.map((o) => o.id),
    happyPct: hp.percent, oldDefaultPrice: hp.percent > 0 ? base + optSum : null,
    category: { id: p.category.id, name: p.category.name, slug: p.category.slug },
    calories: p.calories, protein: p.protein == null ? null : Number(p.protein), carbs: p.carbs == null ? null : Number(p.carbs), fat: p.fat == null ? null : Number(p.fat),
    volumeMl: p.volumeMl, prepMinutes: p.prepMinutes, allergens: p.allergens,
    // состав для покупателя: без упаковки (стаканы, крышки)
    ingredients: items.filter((i) => i.ingredient.category.toLowerCase() !== "packaging").map((i) => i.ingredient.name),
    isVegan: p.isVegan, isHighProtein: p.isHighProtein, isSugarFree: p.isSugarFree,
    available: p.isAvailable && (portions === null || portions > 0), portions, modifiers,
  };
}

export type MenuFilters = { q?: string; category?: string; diet?: string; sort?: string };

export async function listMenu(locationId: string | null, f: MenuFilters = {}) {
  const where: Prisma.ProductWhereInput = { isArchived: false };
  if (f.category) where.category = { slug: f.category };
  if (f.diet === "vegan") where.isVegan = true;
  if (f.diet === "protein") where.isHighProtein = true;
  if (f.diet === "sugarfree") where.isSugarFree = true;
  const q = f.q?.trim().slice(0, 60);
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }];
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    f.sort === "price_asc" ? { price: "asc" } : f.sort === "price_desc" ? { price: "desc" } : f.sort === "calories" ? { calories: "asc" } : { name: "asc" };
  const [rows, stock, rules] = await Promise.all([
    prisma.product.findMany({ where, include: productInclude, orderBy }),
    locationId ? usableStock(prisma, locationId) : Promise.resolve(new Map<string, Prisma.Decimal>()),
    loadRules(),
  ]);
  return rows.map((r) => toPublic(r, stock, rules));
}

export const listCategories = () => prisma.category.findMany({ where: { products: { some: { isArchived: false } } }, orderBy: { sort: "asc" }, select: { id: true, name: true, slug: true } });

export async function getProductBySlug(slug: string, locationId: string | null) {
  const row = await prisma.product.findUnique({ where: { slug }, include: productInclude });
  if (!row || row.isArchived) return null;
  return toPublic(row, locationId ? await usableStock(prisma, locationId) : new Map(), await loadRules());
}

/** Хиты за 30 дней по реальным продажам; если продаж нет — null (на сайте не выдаём это за «хиты»). Кэш на минуту: корзина пересчитывается на каждое нажатие. */
let popularCache: { at: number; ids: string[] | null } | null = null;
export async function popularIds(): Promise<string[] | null> {
  if (popularCache && Date.now() - popularCache.at < 60_000) return popularCache.ids;
  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: { not: "CANCELLED" }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } },
    _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 8,
  });
  const ids = rows.length ? rows.map((r) => r.productId) : null;
  popularCache = { at: Date.now(), ids };
  return ids;
}

/** «Вам может понравиться»: доступное, чего нет в корзине; сначала из категорий, которых в корзине ещё нет. */
export async function suggestions(excludeIds: string[], locationId: string | null, limit = 4) {
  const [all, pop] = await Promise.all([listMenu(locationId), popularIds()]);
  const rank = new Map((pop ?? []).map((id, i) => [id, i]));
  const inCart = new Set(all.filter((p) => excludeIds.includes(p.id)).map((p) => p.category.id));
  return all
    .filter((p) => p.available && !excludeIds.includes(p.id))
    .sort((a, b) => Number(inCart.has(a.category.id)) - Number(inCart.has(b.category.id)) || (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ───────────── Корзина: цены и наличие считает сервер ─────────────
export const cartInputSchema = z.array(z.object({
  productId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(50),
  optionIds: z.array(z.string().min(1).max(40)).max(20),
})).max(50);

export type QuotedLine = {
  productId: string; quantity: number; optionIds: string[];
  slug: string; name: string; categorySlug: string; image: string | null; optionNames: string[];
  unitPrice: number; lineTotal: number; problem: string | null;
};
export type CartQuote = {
  lines: QuotedLine[]; subtotal: number; ok: boolean; suggestions: PublicProduct[];
  /** Акции, сработавшие на корзину, и подсказки «добавьте ещё…» */
  promotions: Applied[]; hints: Hint[]; discount: number;
  /** Совет Мандаринки (что добавить) и общий рейтинг «что докинуть» для других мест (оформление) */
  advice: Advice | null; companions: UpsellPick[];
};

const needsChoice = (p: PublicProduct) => p.modifiers.some((m) => m.required && (m.options.length > 1 || m.multiple));
const toLite = (p: PublicProduct): MenuLite => ({
  id: p.id, slug: p.slug, name: p.name, image: p.image, categoryId: p.category.id, categorySlug: p.category.slug, categoryName: p.category.name,
  price: p.defaultPrice, optionIds: p.defaultOptionIds, needsChoice: needsChoice(p), available: p.available,
});

export async function quoteCart(input: unknown, locationId: string | null): Promise<CartQuote> {
  const items = cartInputSchema.parse(input);
  const menu = await listMenu(locationId);
  const byId = new Map(menu.map((p) => [p.id, p]));
  const lines: QuotedLine[] = items.map((it) => {
    const p = byId.get(it.productId);
    if (!p) return { ...it, slug: "", name: "Позиция недоступна", categorySlug: "", image: null, optionNames: [], unitPrice: 0, lineTotal: 0, problem: "Эта позиция больше не продаётся — удалите её из корзины" };
    const ids = [...new Set(it.optionIds)];
    const all = p.modifiers.flatMap((m) => m.options.map((o) => ({ o, m })));
    const chosen = ids.map((id) => all.find((x) => x.o.id === id));
    let problem: string | null = null;
    if (chosen.some((c) => !c)) problem = "Состав позиции изменился — выберите её заново в меню";
    const ok = chosen.filter((c): c is NonNullable<typeof c> => !!c);
    for (const m of p.modifiers) {
      const n = ok.filter((c) => c.m.id === m.id).length;
      if (!problem && m.required && n === 0) problem = `Выберите «${m.name}»`;
      if (!problem && !m.multiple && n > 1) problem = `«${m.name}»: можно выбрать только один вариант`;
    }
    if (!problem && !p.available) problem = "Сейчас нет в наличии";
    if (!problem && p.portions !== null && it.quantity > p.portions) problem = `Доступно только ${p.portions} шт.`;
    const unitPrice = p.price + ok.reduce((a, c) => a + c.o.priceDelta, 0);
    return { ...it, optionIds: ids, slug: p.slug, name: p.name, categorySlug: p.category.slug, image: p.image, optionNames: ok.map((c) => c.o.name), unitPrice, lineTotal: unitPrice * it.quantity, problem };
  });
  const good = lines.filter((l) => !l.problem);
  const subtotal = good.reduce((a, l) => a + l.lineTotal, 0);
  const promo = good.length
    ? await promotionsForCart(prisma, good.map((l) => ({ productId: l.productId, categoryId: byId.get(l.productId)!.category.id, quantity: l.quantity, unitPrice: l.unitPrice, happy: byId.get(l.productId)!.happyPct > 0 })), { channel: "SITE" })
    : { discount: 0, applied: [], hints: [] };
  const cart = good.map((l) => ({ productId: l.productId, quantity: l.quantity }));
  const [pairs, pop] = await Promise.all([pairStats(cart.map((c) => c.productId)).catch(() => new Map()), popularIds().catch(() => null)]);
  const built = buildAdvice({ cart, menu: menu.map(toLite), pairs, popular: pop, hints: promo.hints, subtotal: Math.max(0, subtotal - promo.discount), exclude: items.map((i) => i.productId) });
  // пока в корзине есть позиция с проблемой, совет только отвлекает: сначала нужно её исправить
  const advice = lines.some((l) => l.problem) ? null : built.advice;
  const companions = built.companions;
  // «Вам может понравиться» — то же ранжирование, но без позиций, которые уже предложила Мандаринка
  const shown = new Set([...items.map((i) => i.productId), ...(advice?.picks.map((p) => p.id) ?? [])]);
  const more = companions.filter((p) => !shown.has(p.id)).slice(0, 4).map((p) => byId.get(p.id)!);
  return { lines, subtotal, ok: lines.length > 0 && lines.every((l) => !l.problem), suggestions: more, promotions: promo.applied, hints: promo.hints, discount: promo.discount, advice, companions: companions.slice(0, 8) };
}
