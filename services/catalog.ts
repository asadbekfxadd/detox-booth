import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { usableStock } from "@/services/availability";

export type PublicOption = { id: string; name: string; priceDelta: number };
export type PublicModifier = { id: string; name: string; multiple: boolean; required: boolean; options: PublicOption[] };
export type PublicProduct = {
  id: string; slug: string; name: string; description: string | null; image: string | null;
  price: number; defaultPrice: number; defaultOptionIds: string[];
  category: { id: string; name: string; slug: string };
  calories: number | null; protein: number | null; carbs: number | null; fat: number | null;
  volumeMl: number | null; prepMinutes: number; allergens: string[];
  isVegan: boolean; isHighProtein: boolean; isSugarFree: boolean;
  available: boolean; portions: number | null; modifiers: PublicModifier[];
};

const productInclude = {
  category: true,
  recipe: { include: { items: true } },
  modifiers: { include: { options: { orderBy: [{ priceDelta: "asc" }, { name: "asc" }] } } },
} satisfies Prisma.ProductInclude;
type Row = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function toPublic(p: Row, stock: Map<string, Prisma.Decimal>): PublicProduct {
  const items = p.recipe?.items ?? [];
  const portions = items.length
    ? Math.max(0, Math.min(...items.map((i) => Math.floor(Number(stock.get(i.ingredientId) ?? 0) / Number(i.quantity)))))
    : null;
  const modifiers = p.modifiers.map((m) => ({
    id: m.id, name: m.name, multiple: m.multiple, required: m.required,
    options: m.options.map((o) => ({ id: o.id, name: o.name, priceDelta: Number(o.priceDelta) })),
  }));
  const defaults = modifiers.filter((m) => m.required && !m.multiple && m.options.length).map((m) => m.options[0]);
  const price = Number(p.price);
  return {
    id: p.id, slug: p.slug, name: p.name, description: p.description, image: p.image,
    price, defaultPrice: price + defaults.reduce((a, o) => a + o.priceDelta, 0), defaultOptionIds: defaults.map((o) => o.id),
    category: { id: p.category.id, name: p.category.name, slug: p.category.slug },
    calories: p.calories, protein: p.protein == null ? null : Number(p.protein), carbs: p.carbs == null ? null : Number(p.carbs), fat: p.fat == null ? null : Number(p.fat),
    volumeMl: p.volumeMl, prepMinutes: p.prepMinutes, allergens: p.allergens,
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
  const [rows, stock] = await Promise.all([
    prisma.product.findMany({ where, include: productInclude, orderBy }),
    locationId ? usableStock(prisma, locationId) : Promise.resolve(new Map<string, Prisma.Decimal>()),
  ]);
  return rows.map((r) => toPublic(r, stock));
}

export const listCategories = () => prisma.category.findMany({ where: { products: { some: { isArchived: false } } }, orderBy: { sort: "asc" }, select: { id: true, name: true, slug: true } });

export async function getProductBySlug(slug: string, locationId: string | null) {
  const row = await prisma.product.findUnique({ where: { slug }, include: productInclude });
  if (!row || row.isArchived) return null;
  return toPublic(row, locationId ? await usableStock(prisma, locationId) : new Map());
}

/** Хиты за 30 дней по реальным продажам; если продаж нет — null (на сайте не выдаём это за «хиты»). */
export async function popularIds(): Promise<string[] | null> {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: { not: "CANCELLED" }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } },
    _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 8,
  });
  return rows.length ? rows.map((r) => r.productId) : null;
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
  slug: string; name: string; categorySlug: string; optionNames: string[];
  unitPrice: number; lineTotal: number; problem: string | null;
};
export type CartQuote = { lines: QuotedLine[]; subtotal: number; ok: boolean; suggestions: PublicProduct[] };

export async function quoteCart(input: unknown, locationId: string | null): Promise<CartQuote> {
  const items = cartInputSchema.parse(input);
  const menu = await listMenu(locationId);
  const byId = new Map(menu.map((p) => [p.id, p]));
  const lines: QuotedLine[] = items.map((it) => {
    const p = byId.get(it.productId);
    if (!p) return { ...it, slug: "", name: "Позиция недоступна", categorySlug: "", optionNames: [], unitPrice: 0, lineTotal: 0, problem: "Эта позиция больше не продаётся — удалите её из корзины" };
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
    return { ...it, optionIds: ids, slug: p.slug, name: p.name, categorySlug: p.category.slug, optionNames: ok.map((c) => c.o.name), unitPrice, lineTotal: unitPrice * it.quantity, problem };
  });
  const subtotal = lines.filter((l) => !l.problem).reduce((a, l) => a + l.lineTotal, 0);
  return { lines, subtotal, ok: lines.length > 0 && lines.every((l) => !l.problem), suggestions: await suggestions(items.map((i) => i.productId), locationId) };
}
