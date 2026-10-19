/**
 * Единицы ингредиентов. Склад и рецепты хранят количество в базовой единице (г, мл, шт),
 * а человеку удобнее кг и литры: цену и минимальный остаток вводим «за 1 кг», показываем «2,5 кг».
 */
export const BASE_UNITS = ["G", "ML", "PC"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

export const UNIT_CHOICES: { value: BaseUnit; label: string; small: string; big: string; hint: string }[] = [
  { value: "G", label: "Вес (кг)", small: "г", big: "кг", hint: "Фрукты, ягоды, овощи, сыпучее. Приход, остаток и цена считаются в кг; в рецептах расход на порцию в граммах." },
  { value: "ML", label: "Жидкость (л)", small: "мл", big: "л", hint: "Соки, молоко, сиропы. Приход, остаток и цена считаются в литрах; в рецептах расход на порцию в мл." },
  { value: "PC", label: "Штуки (шт)", small: "шт", big: "шт", hint: "Стаканчики, крышки, трубочки, яйца." },
];

const SMALL: Record<string, string> = { G: "г", KG: "кг", ML: "мл", L: "л", PC: "шт" };
export const smallLabel = (u: string) => SMALL[u] ?? u;

/** Крупная единица для ввода цены и остатков: г → кг, мл → л. Для остальных её нет (множитель 1). */
export function bigUnit(u: string): { label: string; factor: number } {
  if (u === "G") return { label: "кг", factor: 1000 };
  if (u === "ML") return { label: "л", factor: 1000 };
  return { label: smallLabel(u), factor: 1 };
}

const r6 = (n: number) => Number(n.toFixed(6));
/** Из базовой единицы в крупную: 2500 г → 2,5 кг. */
export const toBig = (u: string, base: number) => r6(base / bigUnit(u).factor);
/** Из крупной в базовую: 2,5 кг → 2500 г. */
export const toBase = (u: string, big: number) => r6(big * bigUnit(u).factor);

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
/** Остаток для людей: 850 г, 2,5 кг, 1,2 л, 40 шт. */
export function fmtQty(u: string, base: number): string {
  const { factor, label } = bigUnit(u);
  if (factor > 1 && Math.abs(base) >= factor) return `${nf.format(base / factor)} ${label}`;
  return `${nf.format(base)} ${smallLabel(u)}`;
}

/** Сколько порций получится из остатка при расходе perPortion (в базовой единице). */
export function portionsFrom(stock: number, perPortion: number): number {
  if (!(perPortion > 0)) return 0;
  return Math.max(0, Math.floor(stock / perPortion + 1e-9));
}

const nf3 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
/** Остаток на складе для людей: всегда кг, л или шт (0,85 кг, 2,5 кг, 1,2 л, 40 шт). Граммы только в рецептах (fmtQty). */
export function fmtStock(u: string, base: number): string {
  const { factor, label } = bigUnit(u);
  return `${nf3.format(base / factor)} ${label}`;
}
