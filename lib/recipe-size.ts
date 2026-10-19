/**
 * Рецепт по размерам. У продукта с размерами («Объём»: 300 мл, 500 мл) граммовка своя для каждого размера:
 * в RecipeSizeItem лежат строки «размер → ингредиент → количество на порцию».
 * Если у выбранного размера есть строки, склад списывается по ним. Нет строк: основной рецепт × коэффициент размера (как раньше).
 */

/** Модификатор-размер: обязательный, с выбором одного из нескольких вариантов, называется «Объём», «Размер» или «Порция» */
export const SIZE_MODIFIER_NAME = /объ[её]м|размер|порци/i;
export function findSizeModifier<M extends { name: string; required: boolean; multiple: boolean; options: unknown[] }>(mods: M[]): M | null {
  return mods.find((m) => m.required && !m.multiple && m.options.length >= 2 && SIZE_MODIFIER_NAME.test(m.name)) ?? null;
}

/** Строки рецепта для выбранных опций: строки первого выбранного размера, у которого они есть. Нет таких, значит null (берём основной рецепт). */
export function pickSizeRows<T extends { optionId: string }>(sizeRows: T[], chosenOptionIds: string[]): T[] | null {
  for (const id of chosenOptionIds) {
    const rows = sizeRows.filter((r) => r.optionId === id);
    if (rows.length) return rows;
  }
  return null;
}
