import type { Hint } from "@/lib/promotions";

/**
 * Подсказки в корзине («Мандаринка советует»). Чистая логика без базы, чтобы её проверяли тесты.
 * Порядок важности: добить акцию → дотянуть до скидки → «с этим берут» (по реальным заказам) → не хватает напитка/еды → хиты.
 * Ничего не выдумываем: фразу «часто берут» показываем только при достаточном числе настоящих заказов.
 */
export type MenuLite = {
  id: string; slug: string; name: string; image: string | null;
  categoryId: string; categorySlug: string; categoryName: string;
  /** Цена с опциями по умолчанию и скидкой счастливых часов */
  price: number; optionIds: string[]; needsChoice: boolean; available: boolean;
};
export type CartLite = { productId: string; quantity: number };
export type UpsellPick = Pick<MenuLite, "id" | "slug" | "name" | "image" | "categorySlug" | "categoryName" | "price" | "optionIds" | "needsChoice">;
/** Для позиции-кандидата: сколько заказов с ней были вместе с позицией из корзины и сколько всего заказов с ней. */
export type PairStat = { anchorId: string; orders: number; total: number };

export type Advice = {
  kind: "promo" | "threshold" | "pair" | "missing" | "popular";
  text: string;
  picks: UpsellPick[];
  /** Полоса «до скидки»: сколько набрано, до какой суммы, сколько осталось */
  progress: { current: number; target: number; left: number } | null;
  /** Какую подсказку по акции заменяет эта карточка (чтобы не показывать дважды) */
  hintId: string | null;
};

/** Меньше стольких общих заказов — пара ещё не считается закономерностью. */
export const MIN_PAIR_ORDERS = 3;
/** Полосу до скидки показываем, когда уже набрано не меньше этой доли порога: далёкая цель только расстраивает. */
export const MIN_PROGRESS = 0.4;

const DRINK = /смузи|сок|фреш|напит|лимонад|чай|кофе|детокс|шот|коктейл|drink|juice|smoothie|fresh|detox|shot|coffee|tea|beverage|lemonade/;
export const isDrink = (c: { categorySlug: string; categoryName: string }) => DRINK.test(`${c.categorySlug} ${c.categoryName}`.toLowerCase());

const pairScore = (s: PairStat) => s.orders / Math.sqrt(Math.max(1, s.total));
const strong = (s: PairStat | undefined): s is PairStat => !!s && s.orders >= MIN_PAIR_ORDERS;

export const toPick = (p: MenuLite): UpsellPick => ({ id: p.id, slug: p.slug, name: p.name, image: p.image, categorySlug: p.categorySlug, categoryName: p.categoryName, price: p.price, optionIds: p.optionIds, needsChoice: p.needsChoice });

/**
 * Подборка под сумму «до порога»: сначала позиции, которые закрывают разрыв одним добавлением и не слишком его превышают,
 * иначе самые подходящие по рейтингу.
 */
export function bridgePicks(ranked: UpsellPick[], left: number, n = 3, quickOnly = false): UpsellPick[] {
  // quickOnly: на оформлении гость заполняет форму, ему нужны позиции «+» в одно касание, без выбора объёма
  const pool = quickOnly && ranked.some((p) => !p.needsChoice) ? ranked.filter((p) => !p.needsChoice) : ranked;
  const cap = Math.max(left * 3, left + 30000);
  const close = pool.filter((p) => p.price >= left && p.price <= cap);
  return (close.length ? close : pool).slice(0, n);
}

export function buildAdvice(a: {
  cart: CartLite[]; menu: MenuLite[]; pairs: Map<string, PairStat>; popular: string[] | null; hints: Hint[]; subtotal: number;
  /** Позиции корзины с проблемой (нет в наличии, не выбран вариант): в cart их нет, но предлагать их же не нужно */
  exclude?: string[];
}): { advice: Advice | null; companions: UpsellPick[] } {
  const byId = new Map(a.menu.map((p) => [p.id, p]));
  const inCart = new Set([...a.cart.map((c) => c.productId), ...(a.exclude ?? [])]);
  const cartItems = a.cart.map((c) => byId.get(c.productId)).filter((p): p is MenuLite => !!p);
  const cartCats = new Set(cartItems.map((p) => p.categoryId));
  const hasDrink = cartItems.some(isDrink), hasFood = cartItems.some((p) => !isDrink(p));
  const need: "food" | "drink" | null = hasDrink && !hasFood ? "food" : hasFood && !hasDrink ? "drink" : null;
  const fits = (p: MenuLite) => need !== null && (need === "food" ? !isDrink(p) : isDrink(p));
  const rank = new Map((a.popular ?? []).map((id, i) => [id, i]));

  const ranked = a.menu
    .filter((p) => p.available && !inCart.has(p.id))
    .sort((x, y) => {
      const px = a.pairs.get(x.id), py = a.pairs.get(y.id);
      const sx = strong(px) ? 1 : 0, sy = strong(py) ? 1 : 0;
      return sy - sx
        || (sx && sy ? pairScore(py!) - pairScore(px!) : 0)
        || Number(fits(y)) - Number(fits(x))
        || (rank.get(x.id) ?? 99) - (rank.get(y.id) ?? 99)
        || Number(cartCats.has(x.categoryId)) - Number(cartCats.has(y.categoryId))
        || x.name.localeCompare(y.name, "ru");
    });
  const companions = ranked.map(toPick);
  const done = (advice: Advice | null) => ({ advice, companions });

  // 1. Акция почти сработала: предлагаем ровно то, чего ей не хватает
  for (const h of a.hints) {
    if (h.fill?.type !== "items") continue;
    const fill = h.fill;
    const pool = a.menu.filter((p) => p.available && (fill.productIds.includes(p.id) || (fill.categoryId != null && p.categoryId === fill.categoryId)));
    const qty = new Map(a.cart.map((c) => [c.productId, c.quantity]));
    pool.sort((x, y) => (qty.get(y.id) ?? 0) - (qty.get(x.id) ?? 0) || (rank.get(x.id) ?? 99) - (rank.get(y.id) ?? 99) || x.price - y.price);
    if (pool.length) return done({ kind: "promo", text: `Почти! ${h.text}`, picks: pool.slice(0, 3).map(toPick), progress: null, hintId: h.id });
  }

  // 2. До скидки осталось немного
  for (const h of a.hints) {
    if (h.fill?.type !== "amount") continue;
    const { base, target, left } = h.fill;
    if (target <= 0 || base / target < MIN_PROGRESS) continue;
    const picks = bridgePicks(companions, left);
    if (!picks.length) continue;
    const close = left <= target * 0.35 ? "Совсем чуть-чуть! " : "";
    return done({ kind: "threshold", text: `${close}${h.text}`, picks, progress: { current: base, target, left }, hintId: h.id });
  }

  // 3. «С этим берут»: только настоящие пары из истории заказов
  const paired = ranked.filter((p) => strong(a.pairs.get(p.id)));
  if (paired.length) {
    const anchor = byId.get(a.pairs.get(paired[0].id)!.anchorId);
    const text = anchor ? `К «${anchor.name}» гости часто берут:` : "С вашим заказом часто берут:";
    return done({ kind: "pair", text, picks: paired.slice(0, 3).map(toPick), progress: null, hintId: null });
  }

  // 4. В корзине только напитки или только еда
  if (need) {
    const picks = ranked.filter(fits).slice(0, 3).map(toPick);
    if (picks.length) {
      const text = need === "food" ? "В корзине одни напитки. Не хотите чего-нибудь перекусить?" : "К еде не хватает напитка. Освежимся?";
      return done({ kind: "missing", text, picks, progress: null, hintId: null });
    }
  }

  // 5. Хиты (только если продажи есть)
  const hits = ranked.filter((p) => rank.has(p.id)).slice(0, 3).map(toPick);
  if (hits.length) return done({ kind: "popular", text: "Сейчас чаще всего заказывают:", picks: hits, progress: null, hintId: null });
  return done(null);
}

/** Сколько не хватает до бесплатной доставки в выбранную зону; null — нечего показывать. */
export function deliveryGap(zone: { fee: number; freeFrom: number | null }, amount: number): { left: number; target: number; save: number } | null {
  if (!(zone.fee > 0) || zone.freeFrom == null || !(zone.freeFrom > 0) || amount >= zone.freeFrom) return null;
  return { left: Math.round(zone.freeFrom - amount), target: zone.freeFrom, save: zone.fee };
}
