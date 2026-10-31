/**
 * Библиотека сочных фото напитков и подбор фото по названию. Основные снимки свои (public/drinks, в одном стиле:
 * стакан, свежие ингредиенты, брызги), остальные из бесплатных снимков Unsplash (указывать автора не нужно).
 * Подбор только предлагает: в админке владелец видит превью и сам выбирает, что применить.
 */
export type DrinkPhoto = { key: string; label: string; /** снимок Unsplash */ id?: string; /** свой снимок: путь на сайте */ file?: string };

const P = (key: string, label: string, id: string): DrinkPhoto => ({ key, label, id });
const OWN = (key: string, label: string): DrinkPhoto => ({ key, label, file: `/drinks/${key}.jpg` });

export const DRINK_PHOTOS: DrinkPhoto[] = [
  OWN("orange", "Апельсиновый фреш"),
  OWN("orange-pitcher", "Апельсин и яблоко"),
  OWN("carrot", "Морковный фреш"),
  OWN("carrot-apple", "Морковь и яблоко"),
  OWN("apple", "Яблочный фреш"),
  P("apple-glasses", "Яблочный сок в стаканах", "1509459331813-67a0c10e527c"),
  OWN("beet", "Свекольный фреш"),
  OWN("pomegranate", "Гранатовый фреш"),
  P("grapefruit", "Грейпфрутовый фреш", "1605002619338-0ed11beb1485"),
  P("lemonade", "Лимонад с мятой и лаймом", "1620400183452-c6e4c7933bd3"),
  P("pineapple", "Ананасовый сок", "1541085681957-a433bdafd5b9"),
  P("watermelon", "Арбузный сок", "1683166263544-e754e85c3e7c"),
  OWN("banana", "Банан и овсянка"),
  OWN("blueberry", "Банан и голубика"),
  P("berry", "Ягодный микс", "1615478503562-ec2d8aa0e24e"),
  P("strawberry", "Клубничный смузи", "1579954115545-a95591f28bfc"),
  OWN("mango", "Манго"),
  P("mango-coconut", "Манго и кокос", "1604298331663-de303fbc7059"),
  P("kiwi", "Зелёный смузи с киви", "1528498033373-3c6c08e93d79"),
  OWN("green", "Зелёный детокс"),
  P("green-charge", "Зелёный заряд", "1610970881699-44a5587cabec"),
  P("celery", "Сельдерей и огурец", "1628751584748-0d780bad3f06"),
  P("ginger", "Имбирный шот", "1682530016814-6a1c1311cd6e"),
  P("turmeric", "Куркума и лимон", "1631029098074-be99eb2b425c"),
  P("coconut", "Кокосовая вода", "1620752420341-4cd7642568dd"),
  P("peanut", "Протеиновый смузи", "1712056407284-c1eda76e7bcd"),
  P("juices", "Фреши из фруктов и овощей", "1603569283847-aa295f0d016a"),
  P("smoothies", "Смузи, два стакана", "1645783916385-1c99860a2a42"),
];

const BY_KEY = new Map(DRINK_PHOTOS.map((p) => [p.key, p]));
export const drinkPhotoByKey = (key: string): DrinkPhoto | null => BY_KEY.get(key) ?? null;
/** Что кладём в Product.image: путь на своём сайте или ссылка Unsplash. */
export const drinkPhotoUrl = (p: DrinkPhoto) => p.file ?? `https://images.unsplash.com/photo-${p.id}?auto=format&fit=crop&w=900&q=75`;
export const drinkPhotoThumb = (p: DrinkPhoto) => p.file ?? `https://images.unsplash.com/photo-${p.id}?auto=format&fit=crop&w=360&q=70`;

type Rule = { key: string; all: string[][] };
// Сначала сочетания (нужны все группы слов), потом одиночные. Внутри группы любое из слов. Слова — корни без окончаний.
const RULES: Rule[] = [
  { key: "carrot-apple", all: [["морков"], ["яблок", "яблоч"]] },
  { key: "orange-pitcher", all: [["апельсин"], ["яблок", "яблоч"]] },
  { key: "blueberry", all: [["банан"], ["голубик", "черник", "ягод", "ежевик"]] },
  { key: "mango-coconut", all: [["манго"], ["кокос"]] },
  { key: "kiwi", all: [["киви"]] },
  { key: "celery", all: [["сельдер", "огурц"]] },
  { key: "beet", all: [["свекл", "свёкл", "бурак"]] },
  { key: "carrot", all: [["морков"]] },
  { key: "orange", all: [["апельсин", "мандарин"]] },
  { key: "pomegranate", all: [["гранат"]] },
  { key: "grapefruit", all: [["грейпфрут", "помело"]] },
  { key: "pineapple", all: [["ананас"]] },
  { key: "watermelon", all: [["арбуз", "дын"]] },
  { key: "lemonade", all: [["лимонад", "лайм", "лимон", "мят"]] },
  { key: "apple", all: [["яблок", "яблоч"]] },
  { key: "strawberry", all: [["клубник", "земляник", "малин"]] },
  { key: "blueberry", all: [["голубик", "черник", "ежевик", "смородин"]] },
  { key: "berry", all: [["ягод"]] },
  { key: "mango", all: [["манго", "маракуй", "тропич"]] },
  { key: "banana", all: [["банан"]] },
  { key: "coconut", all: [["кокос"]] },
  { key: "turmeric", all: [["куркум"]] },
  { key: "ginger", all: [["имбир", "шот"]] },
  { key: "peanut", all: [["арахис", "протеин"]] },
  { key: "green", all: [["шпинат", "зелен", "зелён", "грин", "детокс", "сельдер"]] },
];

export type PhotoPick = { photo: DrinkPhoto; /** match — нашли по названию; fallback — общее фото категории */ kind: "match" | "fallback" };

/** Фото под название напитка. Нет совпадений — общее фото для смузи или фрешей. */
export function pickDrinkPhoto(name: string, isSmoothie = false): PhotoPick {
  const n = name.toLowerCase().replace(/ё/g, "е");
  const has = (stems: string[]) => stems.some((s) => n.includes(s.replace(/ё/g, "е")));
  for (const r of RULES) if (r.all.every(has)) return { photo: BY_KEY.get(r.key)!, kind: "match" };
  return { photo: BY_KEY.get(isSmoothie ? "smoothies" : "juices")!, kind: "fallback" };
}

/** Напиток ли это (смузи, фреш, сок, лимонад, детокс, коктейль) — по названию категории или её ссылке. */
export const isDrinkCategory = (name: string, slug: string) =>
  /смузи|фреш|сок|напит|коктейл|лимонад|детокс|вода|шот|drink|juice|smoothie|fresh|detox|cocktail/i.test(`${name} ${slug}`);
export const isSmoothieCategory = (name: string, slug: string) => /смузи|коктейл|smoothie|cocktail|shake/i.test(`${name} ${slug}`);
