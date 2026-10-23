/**
 * Рецепт по размерам. У продукта с размерами («Объём»: 300 мл, 500 мл) граммовка своя для каждого размера:
 * в RecipeSizeItem лежат строки «размер → ингредиент → количество на порцию».
 * Если у выбранного размера есть строки, склад списывается по ним. Нет строк: основной рецепт × коэффициент размера (как раньше).
 */

/** Модификатор-размер: обязательный, с выбором одного из нескольких вариантов, называется «Объём», «Размер» или «Порция» */
export const SIZE_MODIFIER_NAME = /объ[её]м|размер|порци/i;
export function findSizeModifier<M extends { name: string; required: boolean; multiple: boolean; options: unknown[] }>(mods: M[], minOptions = 2): M | null {
  return mods.find((m) => m.required && !m.multiple && m.options.length >= minOptions && SIZE_MODIFIER_NAME.test(m.name)) ?? null;
}

/** Объём из названия размера: «330 мл» → 330, «1 л» → 1000, «0,5 л» → 500. Нет числа: null. */
export function mlOf(name: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(мл|ml|л|l)(?![а-яa-z])/i.exec(name);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(/^(л|l)$/i.test(m[2]) ? n * 1000 : n);
}

/** Во сколько раз новый размер больше образца (по объёму в названиях); если объём не найден, 1. */
export function sizeRatio(fromName: string, toName: string): number {
  const a = mlOf(fromName), b = mlOf(toName);
  return a && b ? b / a : 1;
}

/** Ближайший по объёму образец, с которого копируем граммы: тот, чей объём ближе к новому; без объёмов последний. */
export function pickReference<T extends { name: string }>(cols: T[], newName: string): T | null {
  if (!cols.length) return null;
  const target = mlOf(newName);
  if (target == null) return cols[cols.length - 1];
  let best: T | null = null, bestD = Infinity;
  for (const c of cols) { const v = mlOf(c.name); if (v == null) continue; const d = Math.abs(Math.log(v / target)); if (d < bestD) { best = c; bestD = d; } }
  return best ?? cols[cols.length - 1];
}

/** Строки рецепта для выбранных опций: строки первого выбранного размера, у которого они есть. Нет таких, значит null (берём основной рецепт). */
export function pickSizeRows<T extends { optionId: string }>(sizeRows: T[], chosenOptionIds: string[]): T[] | null {
  for (const id of chosenOptionIds) {
    const rows = sizeRows.filter((r) => r.optionId === id);
    if (rows.length) return rows;
  }
  return null;
}
