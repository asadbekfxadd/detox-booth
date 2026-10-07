export const BASE_LABEL: Record<string, string> = { G: "г", KG: "кг", ML: "мл", L: "л", PC: "шт" };
/** Для г и мл можно вводить в кг и л: удобнее, чем тысячи граммов. */
export const bigUnit = (u: string): { label: string; mult: number } | null =>
  u === "G" ? { label: "кг", mult: 1000 } : u === "ML" ? { label: "л", mult: 1000 } : null;
export const round6 = (n: number) => Number(n.toFixed(6));
