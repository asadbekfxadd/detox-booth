/**
 * Стандартное кофейное меню: 10 позиций со средними ценами по городу (сум), размерами и рецептами.
 * Цены и граммовку владелец меняет в карточке и в рецепте. Фото — бесплатные снимки Unsplash (указывать автора не нужно).
 */
export const COFFEE_CATEGORY = "Кофе";

export type CoffeeIngredient = { key: string; name: string; unit: "G" | "ML"; category: string };
export const COFFEE_INGREDIENTS: CoffeeIngredient[] = [
  { key: "beans", name: "Кофе в зёрнах", unit: "G", category: "Кофе и какао" },
  { key: "milk", name: "Молоко", unit: "ML", category: "Молочные" },
  { key: "cream", name: "Сливки", unit: "ML", category: "Молочные" },
  { key: "cocoa", name: "Какао-порошок", unit: "G", category: "Кофе и какао" },
];

export type CoffeeSize = { name: string; price: number; items: { ing: CoffeeIngredient["key"]; qty: number }[] };
export type CoffeeItem = {
  name: string; description: string; photo: string; prep: number; allergens: string[];
  /** добавить выбор молока (обычное, миндальное, овсяное, кокосовое) */
  milk?: boolean;
  sizes: CoffeeSize[];
};

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=75`;
const PHOTO = {
  cup: "1495474472287-4d71bcdd2085",
  espresso: "1511920170033-f8396924c348",
  latte: "1461023058943-07fcbe16d735",
  cappuccino: "1514432324607-a09d9b4aefdd",
  art: "1572442388796-11668a67e53d",
  iced: "1517701604599-bb29b565090c",
  beans: "1447933601403-0c6688de566e",
  mug: "1509042239860-f550ce710b93",
} as const;
export const coffeePhoto = (key: keyof typeof PHOTO) => img(PHOTO[key]);

export const COFFEE: CoffeeItem[] = [
  { name: "Эспрессо", description: "Крепкий насыщенный кофе из свежемолотых зёрен. Одинарный или двойной.", photo: coffeePhoto("espresso"), prep: 2, allergens: [],
    sizes: [{ name: "30 мл", price: 15000, items: [{ ing: "beans", qty: 9 }] }, { name: "60 мл", price: 22000, items: [{ ing: "beans", qty: 18 }] }] },
  { name: "Американо", description: "Эспрессо с горячей водой. Мягкий, на каждый день.", photo: coffeePhoto("cup"), prep: 2, allergens: [],
    sizes: [{ name: "250 мл", price: 18000, items: [{ ing: "beans", qty: 18 }] }, { name: "350 мл", price: 24000, items: [{ ing: "beans", qty: 27 }] }] },
  { name: "Капучино", description: "Эспрессо, молоко и плотная молочная пена.", photo: coffeePhoto("cappuccino"), prep: 3, allergens: ["milk"], milk: true,
    sizes: [{ name: "250 мл", price: 25000, items: [{ ing: "beans", qty: 18 }, { ing: "milk", qty: 150 }] }, { name: "350 мл", price: 32000, items: [{ ing: "beans", qty: 27 }, { ing: "milk", qty: 220 }] }] },
  { name: "Латте", description: "Много нежного молока, немного эспрессо и тонкая пенка.", photo: coffeePhoto("latte"), prep: 3, allergens: ["milk"], milk: true,
    sizes: [{ name: "300 мл", price: 27000, items: [{ ing: "beans", qty: 18 }, { ing: "milk", qty: 220 }] }, { name: "400 мл", price: 34000, items: [{ ing: "beans", qty: 27 }, { ing: "milk", qty: 290 }] }] },
  { name: "Флэт уайт", description: "Двойной эспрессо с бархатным молоком. Крепче латте.", photo: coffeePhoto("art"), prep: 3, allergens: ["milk"], milk: true,
    sizes: [{ name: "200 мл", price: 28000, items: [{ ing: "beans", qty: 18 }, { ing: "milk", qty: 120 }] }] },
  { name: "Раф", description: "Эспрессо со сливками и ванилью. Сладкий и очень нежный.", photo: coffeePhoto("mug"), prep: 4, allergens: ["milk"],
    sizes: [{ name: "300 мл", price: 30000, items: [{ ing: "beans", qty: 18 }, { ing: "cream", qty: 200 }] }, { name: "400 мл", price: 37000, items: [{ ing: "beans", qty: 27 }, { ing: "cream", qty: 270 }] }] },
  { name: "Мокко", description: "Эспрессо, молоко и какао. Кофе для сладкоежек.", photo: coffeePhoto("latte"), prep: 4, allergens: ["milk"], milk: true,
    sizes: [{ name: "300 мл", price: 30000, items: [{ ing: "beans", qty: 18 }, { ing: "milk", qty: 180 }, { ing: "cocoa", qty: 20 }] }] },
  { name: "Какао", description: "Горячее какао на молоке. Без кофе.", photo: coffeePhoto("mug"), prep: 3, allergens: ["milk"], milk: true,
    sizes: [{ name: "300 мл", price: 25000, items: [{ ing: "cocoa", qty: 25 }, { ing: "milk", qty: 250 }] }] },
  { name: "Айс-латте", description: "Холодный латте со льдом. Освежает в жару.", photo: coffeePhoto("iced"), prep: 3, allergens: ["milk"], milk: true,
    sizes: [{ name: "400 мл", price: 30000, items: [{ ing: "beans", qty: 18 }, { ing: "milk", qty: 200 }] }] },
  { name: "Колд брю", description: "Кофе холодной экстракции: мягкий, без кислинки, подаётся со льдом.", photo: coffeePhoto("iced"), prep: 2, allergens: [],
    sizes: [{ name: "300 мл", price: 28000, items: [{ ing: "beans", qty: 25 }] }] },
];

export const MILK_MODIFIER = { name: "Молоко", options: [["Обычное", 0], ["Миндальное", 5000], ["Овсяное", 5000], ["Кокосовое", 6000]] as [string, number][] };
export const SUGAR_MODIFIER = { name: "Сахар", options: [["Без сахара", 0], ["С сахаром", 0]] as [string, number][] };
