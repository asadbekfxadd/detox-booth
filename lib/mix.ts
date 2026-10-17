/**
 * «Свой микс»: гость сам выбирает ингредиенты для стакана.
 *
 *   цена = цена размера + сумма доплат за выбранные ингредиенты
 *   состав = масса стакана делится между выбранными ингредиентами поровну
 *
 * Здесь только арифметика без базы: легко проверять тестами и использовать и на сервере, и в браузере.
 */
import { z } from "zod";
import { isPackaging } from "@/lib/costing";

/** Размер стакана: цена, масса состава (граммы фруктов на стакан) и стаканчик, который списывается со склада. */
export type MixSize = { id: string; name: string; price: number; grams: number; cupIngredientId: string | null };
export type MixIngredient = {
  id: string; name: string; category: string; unit: string;
  /** Доплата за ингредиент, UZS */
  surcharge: number;
  /** Вес одной штуки, г (нужен только для ингредиентов в штуках) */
  pieceWeightG: number | null;
};

/** Один ингредиент в миксе: сколько списать (в единице склада) и сколько он стоит гостю сверх цены размера */
export type MixPortion = { ingredientId: string; name: string; qty: number; surcharge: number };

/** Технический потолок на случай мусора в запросе; для гостя ограничений по числу ингредиентов нет. */
export const MIX_MAX_INGREDIENTS = 30;
export const MIX_MAX_SIZES = 5;
export const MIX_PRODUCT_SLUG = "svoy-mix";
export const MIX_PRODUCT_NAME = "Свой микс";

/** Выбор гостя: размер и ингредиенты. Всё остальное (цену, граммовку) считает сервер. */
export const mixInputSchema = z.object({
  sizeId: z.string().min(1).max(40),
  ingredientIds: z.array(z.string().min(1).max(40)).min(1, "Выберите хотя бы один ингредиент").max(MIX_MAX_INGREDIENTS, "Слишком много ингредиентов"),
});
export type MixInput = z.infer<typeof mixInputSchema>;

/** Метки в modifiers позиции заказа: по ним склад списывает ингредиенты, а кухня и чек показывают состав */
export const MIX_SIZE = "mixSize";
export const MIX_ING = "mixIng";
export type MixModifier =
  | { kind: typeof MIX_SIZE; name: string; sizeId: string; priceDelta: number; cupIngredientId: string | null }
  | { kind: typeof MIX_ING; name: string; ingredientId: string; qty: number; priceDelta: number };

/** Можно ли положить ингредиент в микс: не упаковка и понятен вес (штучным нужен вес штуки) */
export function mixable(i: Pick<MixIngredient, "category" | "unit" | "pieceWeightG">): boolean {
  if (isPackaging(i.category)) return false;
  if (i.unit === "PC") return (i.pieceWeightG ?? 0) > 0;
  return true;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Сколько ингредиента нужно, если на него приходится grams граммов состава (в единице склада) */
export function gramsToQty(i: Pick<MixIngredient, "unit" | "pieceWeightG">, grams: number): number {
  switch (i.unit) {
    case "G": case "ML": return r2(grams); // 1 мл ≈ 1 г: соки и молоко
    case "KG": case "L": return Math.round((grams / 1000) * 1e6) / 1e6;
    case "PC": return i.pieceWeightG && i.pieceWeightG > 0 ? Math.round((grams / i.pieceWeightG) * 1000) / 1000 : 0;
    default: return 0;
  }
}

/** Порции выбранных ингредиентов: масса размера делится поровну */
export function mixPortions(size: Pick<MixSize, "grams">, chosen: MixIngredient[]): MixPortion[] {
  if (chosen.length === 0) return [];
  const each = size.grams / chosen.length;
  return chosen.map((i) => ({ ingredientId: i.id, name: i.name, qty: gramsToQty(i, each), surcharge: i.surcharge }));
}

/** Цена одного стакана */
export const mixPrice = (size: Pick<MixSize, "price">, chosen: Pick<MixIngredient, "surcharge">[]): number =>
  r2(size.price + chosen.reduce((a, i) => a + Math.max(0, i.surcharge), 0));

/** Что записать в modifiers позиции заказа (снимок: цены и граммовки потом можно менять, заказ останется прежним) */
export function mixModifiers(size: MixSize, portions: MixPortion[]): MixModifier[] {
  return [
    { kind: MIX_SIZE, name: size.name, sizeId: size.id, priceDelta: size.price, cupIngredientId: size.cupIngredientId },
    ...portions.map((p) => ({ kind: MIX_ING, name: p.name, ingredientId: p.ingredientId, qty: p.qty, priceDelta: p.surcharge }) as MixModifier),
  ];
}

/** Что нужно со склада на одну позицию заказа по её modifiers (стаканчик и ингредиенты). Не-микс возвращает пусто. */
export function mixNeedsFromModifiers(modifiers: unknown): { ingredientId: string; qty: number }[] {
  if (!Array.isArray(modifiers)) return [];
  const out: { ingredientId: string; qty: number }[] = [];
  for (const m of modifiers as Partial<MixModifier>[]) {
    if (!m || typeof m !== "object") continue;
    if (m.kind === MIX_ING && typeof m.ingredientId === "string" && typeof m.qty === "number" && m.qty > 0) out.push({ ingredientId: m.ingredientId, qty: m.qty });
    if (m.kind === MIX_SIZE && typeof m.cupIngredientId === "string" && m.cupIngredientId) out.push({ ingredientId: m.cupIngredientId, qty: 1 });
  }
  return out;
}

/** Выбор гостя из сохранённой позиции заказа (для «Повторить заказ»). Не микс — null. */
export function mixFromModifiers(modifiers: unknown): MixInput | null {
  if (!Array.isArray(modifiers)) return null;
  const mods = modifiers as Partial<MixModifier>[];
  const size = mods.find((m): m is Extract<MixModifier, { kind: typeof MIX_SIZE }> => m?.kind === MIX_SIZE);
  if (!size || typeof size.sizeId !== "string") return null;
  const ids = mods.flatMap((m) => (m?.kind === MIX_ING && typeof m.ingredientId === "string" ? [m.ingredientId] : []));
  return ids.length ? { sizeId: size.sizeId, ingredientIds: ids } : null;
}

/** Ключ позиции в корзине: один и тот же набор в том же размере склеивается в одну строку */
export const mixKey = (m: { sizeId: string; ingredientIds: string[] }) => `mix:${m.sizeId}:${[...new Set(m.ingredientIds)].sort().join(",")}`;

/** Для обычных заказов без микса: ничего не меняем. Для кухни: «Яблоко, Апельсин» вместо технических записей. */
export const isMixModifiers = (modifiers: unknown) => Array.isArray(modifiers) && (modifiers as { kind?: string }[]).some((m) => m?.kind === MIX_SIZE);
