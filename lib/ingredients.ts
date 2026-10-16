/**
 * Справочник ингредиентов для иллюстраций: по корню русского слова находим эмодзи и английское название.
 * Нужен анимации «Смотреть сборку» и описаниям для AI-видео. Неизвестные ингредиенты просто пропускаются.
 */
const TABLE: [stem: string, emoji: string, en: string][] = [
  ["апельсин", "🍊", "oranges"], ["мандарин", "🍊", "mandarins"], ["грейпфрут", "🍊", "grapefruit"],
  ["лимон", "🍋", "lemons"], ["лайм", "🍋", "limes"], ["банан", "🍌", "bananas"],
  ["клубник", "🍓", "strawberries"], ["клубнич", "🍓", "strawberries"], ["земляни", "🍓", "strawberries"], ["малин", "🍓", "raspberries"],
  ["черник", "🫐", "blueberries"], ["ягод", "🫐", "mixed berries"], ["смородин", "🫐", "currants"],
  ["манго", "🥭", "mango"], ["ананас", "🍍", "pineapple"], ["арбуз", "🍉", "watermelon"], ["дын", "🍈", "melon"],
  ["киви", "🥝", "kiwi"], ["яблок", "🍎", "apples"], ["яблоч", "🍎", "apples"], ["груш", "🍐", "pears"], ["персик", "🍑", "peaches"],
  ["абрикос", "🍑", "apricots"], ["вишн", "🍒", "cherries"], ["виноград", "🍇", "grapes"], ["авокадо", "🥑", "avocado"],
  ["кокос", "🥥", "coconut"], ["морков", "🥕", "carrots"], ["огур", "🥒", "cucumber"], ["шпинат", "🥬", "spinach"],
  ["капуст", "🥬", "kale"], ["сельдер", "🥬", "celery"], ["петрушк", "🌿", "parsley"], ["мят", "🌿", "fresh mint"],
  ["базилик", "🌿", "basil"], ["имбир", "🫚", "ginger"], ["тыкв", "🎃", "pumpkin"], ["мед", "🍯", "honey"],
  ["арахис", "🥜", "peanuts"], ["миндал", "🥜", "almonds"], ["орех", "🥜", "nuts"], ["молок", "🥛", "milk"],
  ["йогурт", "🥛", "yogurt"], ["овсян", "🌾", "oats"], ["гранол", "🌾", "granola"], ["кофе", "☕", "coffee"],
  ["чай", "🍵", "tea"], ["лед", "🧊", "ice cubes"], ["протеин", "💪", "protein powder"],
];

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

export type Known = { emoji: string; en: string };

/** Все узнанные в тексте ингредиенты в порядке появления: «Клубника-банан» даёт клубнику и банан. */
function matches(text: string): Known[] {
  const n = norm(text);
  return TABLE.map(([stem, emoji, en]) => ({ at: n.indexOf(stem), emoji, en }))
    .filter((m) => m.at >= 0).sort((a, b) => a.at - b.at).map(({ emoji, en }) => ({ emoji, en }));
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
