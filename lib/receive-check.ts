/**
 * Проверки прихода «на глаз»: не блокируют оформление, а подсказывают про опечатки (лишний ноль, цена за граммы).
 * Количество и цена здесь в тех же единицах, что видит человек: кг, л или шт.
 */
export type CheckRow = { ingredientId: string; unit: string; qty: number; cost: number | null; lastCost: number | null };

/** Больше этого за один приход почти наверняка лишний ноль */
const BIG_QTY: Record<string, number> = { "кг": 300, "л": 300, "шт": 20000 };

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const n = (x: number) => nf.format(x);

/** Предупреждения по каждой строке (индекс в индекс). Пустая строка массива — всё в порядке. */
export function receiveWarnings(rows: (CheckRow | null)[]): string[][] {
  const seen = new Map<string, number>();
  return rows.map((r, idx) => {
    if (!r) return [];
    const w: string[] = [];
    const limit = BIG_QTY[r.unit];
    if (limit && r.qty > limit) w.push(`${n(r.qty)} ${r.unit} — это очень много, проверьте, нет ли лишнего нуля`);
    if (r.cost != null) {
      if (r.cost === 0) w.push("Цена 0: средняя цена продукта снизится");
      else if (r.lastCost && r.lastCost > 0) {
        const k = r.cost / r.lastCost;
        if (k >= 5) w.push(`Цена в ${n(k)} раз выше прошлой (${n(r.lastCost)}): нет ли лишнего нуля?`);
        else if (k <= 0.2) w.push(`Цена в ${n(1 / k)} раз ниже прошлой (${n(r.lastCost)}): цена указана за 1 ${r.unit}?`);
        else if (k >= 1.3) w.push(`Дороже прошлой закупки (${n(r.lastCost)}) на ${n((k - 1) * 100)}%`);
        else if (k <= 0.7) w.push(`Дешевле прошлой закупки (${n(r.lastCost)}) на ${n((1 - k) * 100)}%`);
      }
    }
    const first = seen.get(r.ingredientId);
    if (first == null) seen.set(r.ingredientId, idx + 1);
    else w.push(`Этот продукт уже есть в строке ${first}: если это одна поставка, объедините строки`);
    return w;
  });
}
