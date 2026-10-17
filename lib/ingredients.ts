/**
 * Справочник ингредиентов для иллюстраций: по корню русского слова находим эмодзи и английское название.
 * Нужен анимации «Смотреть сборку» и описаниям для AI-видео. Неизвестные ингредиенты просто пропускаются.
 */
const TABLE: [stem: string, emoji: string, en: string, color: string][] = [
  ["апельсин", "🍊", "oranges", "#ff9a1a"], ["мандарин", "🍊", "mandarins", "#ff9a1a"], ["грейпфрут", "🍊", "grapefruit", "#ff7a7a"],
  ["лимон", "🍋", "lemons", "#f5d442"], ["лайм", "🍋", "limes", "#8fd14f"], ["банан", "🍌", "bananas", "#f6dc8c"],
  ["клубник", "🍓", "strawberries", "#ff5a6e"], ["клубнич", "🍓", "strawberries", "#ff5a6e"], ["земляни", "🍓", "strawberries", "#ff5a6e"], ["малин", "🍓", "raspberries", "#e0446a"],
  ["черник", "🫐", "blueberries", "#7b5fd1"], ["ягод", "🫐", "mixed berries", "#9a4fa8"], ["смородин", "🫐", "currants", "#8a2f5a"],
  ["манго", "🥭", "mango", "#ffb627"], ["ананас", "🍍", "pineapple", "#ffd54a"], ["арбуз", "🍉", "watermelon", "#ff6b81"], ["дын", "🍈", "melon", "#ffcf8a"],
  ["киви", "🥝", "kiwi", "#8ccf3e"], ["яблок", "🍎", "apples", "#e6d878"], ["яблоч", "🍎", "apples", "#e6d878"], ["груш", "🍐", "pears", "#d3e29c"], ["персик", "🍑", "peaches", "#ffb07a"],
  ["абрикос", "🍑", "apricots", "#ffb347"], ["вишн", "🍒", "cherries", "#c2185b"], ["виноград", "🍇", "grapes", "#8e5bb5"], ["авокадо", "🥑", "avocado", "#a3c95c"],
  ["кокос", "🥥", "coconut", "#f3efe3"], ["морков", "🥕", "carrots", "#ff8c1a"], ["огур", "🥒", "cucumber", "#9fd38a"], ["шпинат", "🥬", "spinach", "#4cae4f"],
  ["капуст", "🥬", "kale", "#4cae4f"], ["сельдер", "🥬", "celery", "#6fbf5a"], ["петрушк", "🌿", "parsley", "#5fbf6a"], ["мят", "🌿", "fresh mint", "#5fbf6a"],
  ["базилик", "🌿", "basil", "#5fbf6a"], ["имбир", "🫚", "ginger", "#e8c36a"], ["тыкв", "🎃", "pumpkin", "#ff9a3c"], ["мед", "🍯", "honey", "#f2b134"],
  ["арахис", "🥜", "peanuts", "#c89a62"], ["миндал", "🥜", "almonds", "#c89a62"], ["орех", "🥜", "nuts", "#c89a62"], ["молок", "🥛", "milk", "#f7f3ea"],
  ["йогурт", "🥛", "yogurt", "#f7f3ea"], ["овсян", "🌾", "oats", "#e6d3a3"], ["гранол", "🌾", "granola", "#e6d3a3"], ["кофе", "☕", "coffee", "#6f4a35"],
  ["чай", "🍵", "tea", "#c9863d"], ["лед", "🧊", "ice cubes", ""], ["протеин", "💪", "protein powder", "#efe3d0"],
];

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

/** color — цвет напитка от этого ингредиента; у льда его нет */
export type Known = { emoji: string; en: string; color: string };

/** Все узнанные в тексте ингредиенты в порядке появления: «Клубника-банан» даёт клубнику и банан. */
function matches(text: string): Known[] {
  const n = norm(text);
  return TABLE.map(([stem, emoji, en, color]) => ({ at: n.indexOf(stem), emoji, en, color }))
    .filter((m) => m.at >= 0).sort((a, b) => a.at - b.at).map(({ emoji, en, color }) => ({ emoji, en, color }));
}

export const findIngredient = (name: string): Known | null => matches(name)[0] ?? null;

/**
 * Узнанные ингредиенты без повторов (два «клубничных» не дают две клубники) в порядке следования.
 * Принимает и названия ингредиентов рецепта, и обычный текст, например название и описание позиции.
 */
export function knownIngredients(texts: string[], max = 4): Known[] {
  const out: Known[] = [];
  for (const t of texts) for (const k of matches(t)) {
    if (!out.some((o) => o.en === k.en)) out.push(k);
    if (out.length >= max) return out;
  }
  return out;
}

/** Можно ли рубить: лёд, молоко, мёд, злаки, напитки и порошок в блендер кладут целиком, ножом по ним не бьют. */
const NOT_CUT = new Set(["🧊", "🥛", "🍯", "🌾", "☕", "🍵", "💪", "🥜"]);
export const isChoppable = (emoji: string) => !NOT_CUT.has(emoji);

/**
 * Цвет напитка из ингредиентов. Среднее красного с зелёным даёт грязно-коричневый, поэтому за основу берём главный (первый яркий)
 * ингредиент, а остальные лишь подмешиваем (30%): клубника с бананом и киви остаётся розовато-красной, молоко только высветляет.
 * Лёд цвета не имеет. Нет ни одного цвета: null, тогда берётся цвет категории.
 */
export function drinkColor(items: { color: string }[]): string | null {
  const rgb = items.map((i) => i.color).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map((c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)));
  if (rgb.length === 0) return null;
  // яркость по модели HSV: бледное (молоко, овсянка) не может быть главным, пока есть яркое
  const vivid = (c: number[]) => (Math.max(...c) - Math.min(...c)) / Math.max(1, Math.max(...c));
  const main = rgb.find((c) => vivid(c) > 0.22) ?? rgb[0];
  const rest = rgb.filter((c) => c !== main);
  const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  if (rest.length === 0) return hex(main);
  const weight = (c: number[]) => Math.max(0.02, vivid(c) ** 2);
  const total = rest.reduce((sum, c) => sum + weight(c), 0);
  const others = [0, 1, 2].map((k) => rest.reduce((sum, c) => sum + c[k] * weight(c), 0) / total);
  return hex([0, 1, 2].map((k) => main[k] * 0.7 + others[k] * 0.3));
}
