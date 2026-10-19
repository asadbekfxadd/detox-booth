export const BASE_LABEL: Record<string, string> = { G: "г", KG: "кг", ML: "мл", L: "л", PC: "шт" };
/** Для г и мл можно вводить в кг и л: удобнее, чем тысячи граммов. */
export const bigUnit = (u: string): { label: string; mult: number } | null =>
  u === "G" ? { label: "кг", mult: 1000 } : u === "ML" ? { label: "л", mult: 1000 } : null;
export const round6 = (n: number) => Number(n.toFixed(6));

/**
 * Единица, в которой вводят приход, закупку, списание и перемещение: кг, л или шт. Граммов и миллилитров здесь нет.
 * mult — во сколько раз она больше учётной (склад хранит г, мл, шт). Старые ингредиенты в кг и л уже в этих единицах (mult 1).
 */
export const recvUnit = (u: string): { label: string; mult: number } =>
  u === "G" ? { label: "кг", mult: 1000 } : u === "ML" ? { label: "л", mult: 1000 } : { label: BASE_LABEL[u] ?? u, mult: 1 };
