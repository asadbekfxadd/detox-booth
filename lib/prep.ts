/**
 * Заготовки (полуфабрикаты): чистая арифметика без базы, чтобы легко проверять тестами.
 * Рецепт заготовки: из items получается outputQty. Хотим получить want: сырья нужно пропорционально больше или меньше.
 */
export type PrepItem = { ingredientId: string; quantity: number };

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Сколько сырья нужно, чтобы получить want заготовки */
export function scalePrepItems(items: PrepItem[], outputQty: number, want: number): PrepItem[] {
  if (!(outputQty > 0) || !(want > 0)) return items.map((i) => ({ ingredientId: i.ingredientId, quantity: 0 }));
  const k = want / outputQty;
  return items.map((i) => ({ ingredientId: i.ingredientId, quantity: r3(i.quantity * k) }));
}

/** Себестоимость единицы заготовки: стоимость всего сырья ÷ сколько получилось */
export function prepUnitCost(totalCost: number, outputQty: number): number {
  return outputQty > 0 ? totalCost / outputQty : 0;
}

/**
 * Заготовка может входить в другую заготовку (сироп → микс), но не по кругу.
 * graph: заготовка → из чего она делается. Проверяем, приведёт ли новый состав prepId обратно к ней самой.
 */
export function makesCycle(graph: Map<string, string[]>, prepId: string, components: string[]): boolean {
  const seen = new Set<string>();
  const stack = [...components];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === prepId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of graph.get(id) ?? []) stack.push(next);
  }
  return false;
}
