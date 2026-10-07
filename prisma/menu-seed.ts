import type { PrismaClient } from "@prisma/client";

/**
 * Расширенное меню Vitamin B: категории, 41 позиция, опции и фото.
 * Фото — Unsplash (бесплатная лицензия, можно использовать в коммерческих целях без указания автора).
 * Скрипт только ДОБАВЛЯЕТ недостающее: существующие позиции, цены и описания не перезаписываются.
 */

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=75`;

export const CATEGORIES = [
  { slug: "smoothies", name: "Смузи" },
  { slug: "fresh", name: "Фреши и соки" },
  { slug: "detox", name: "Детокс" },
  { slug: "bowls", name: "Боулы" },
  { slug: "salads", name: "Салаты" },
  { slug: "healthy-snacks", name: "Перекусы" },
  { slug: "fruits", name: "Фрукты" },
  { slug: "sets", name: "Сеты" },
] as const;

type Opt = [name: string, priceDelta: number, recipeMultiplier?: number];
type Mod = { name: string; multiple: boolean; required: boolean; options: Opt[] };

const SIZE_DRINK: Mod = { name: "Объём", multiple: false, required: true, options: [["300 мл", 0], ["450 мл", 10000, 1.5]] };
const SIZE_FRESH: Mod = { name: "Объём", multiple: false, required: true, options: [["300 мл", 0], ["500 мл", 10000, 1.6]] };
/** Пожелания к напитку: бесплатные и необязательные, на цену и состав рецепта не влияют. */
const ICE: Mod = { name: "Лёд", multiple: false, required: false, options: [["Без льда", 0], ["Немного льда", 0], ["Много льда", 0]] };
const SUGAR: Mod = { name: "Сладость", multiple: false, required: false, options: [["Без добавок", 0], ["Послаще", 0]] };
const DRINK_CATEGORIES = ["smoothies", "fresh", "detox"];
const MILK: Mod = { name: "Молоко", multiple: false, required: true, options: [["Обычное", 0], ["Миндальное", 5000], ["Овсяное", 5000], ["Кокосовое", 6000]] };
const BOOST: Mod = { name: "Добавки", multiple: true, required: false, options: [["Протеин", 8000], ["Чиа", 4000], ["Мёд", 3000], ["Семена льна", 3000], ["Спирулина", 6000], ["Гранола", 5000]] };
const TOPPINGS: Mod = { name: "Топпинги", multiple: true, required: false, options: [["Свежие ягоды", 8000], ["Кокосовая стружка", 3000], ["Арахисовая паста", 5000], ["Мёд", 3000], ["Чиа", 4000], ["Протеин", 8000]] };
const SALAD_ADD: Mod = { name: "Добавить в салат", multiple: true, required: false, options: [["Курица гриль", 14000], ["Авокадо", 12000], ["Яйцо", 5000], ["Фета", 8000]] };

export type MenuItem = {
  slug: string; name: string; cat: (typeof CATEGORIES)[number]["slug"]; price: number; photo: string; desc: string;
  cal: number; p: number; c: number; f: number; vol?: number; prep?: number; allergens?: string[];
  vegan?: boolean; protein?: boolean; sugarFree?: boolean; mods?: Mod[];
};

export const MENU: MenuItem[] = [
  // ---------- Смузи ----------
  { slug: "tropical-mango", name: "Тропический манго", cat: "smoothies", price: 32000, photo: "1623065422902-30a2d299bbe4", vol: 300, cal: 210, p: 3, c: 48, f: 1, vegan: true,
    desc: "Спелое манго, банан и свежий апельсин. Густой и сладкий без добавленного сахара.", mods: [SIZE_DRINK, BOOST] },
  { slug: "strawberry-banana", name: "Клубника-банан", cat: "smoothies", price: 32000, photo: "1579954115545-a95591f28bfc", vol: 300, cal: 240, p: 7, c: 44, f: 4, allergens: ["milk"],
    desc: "Клубника, банан, натуральный йогурт и молоко на выбор.", mods: [SIZE_DRINK, MILK, BOOST] },
  { slug: "green-charge", name: "Зелёный заряд", cat: "smoothies", price: 30000, photo: "1610970881699-44a5587cabec", vol: 300, cal: 160, p: 3, c: 34, f: 1, vegan: true,
    desc: "Шпинат, яблоко, банан и лайм. Свежий, лёгкий, без молока.", mods: [SIZE_DRINK, BOOST] },
  { slug: "berry-mix", name: "Ягодный микс", cat: "smoothies", price: 34000, photo: "1615478503562-ec2d8aa0e24e", vol: 300, cal: 230, p: 8, c: 40, f: 4, allergens: ["milk"],
    desc: "Черника, малина, клубника и йогурт. Кисло-сладкий, насыщенного цвета.", mods: [SIZE_DRINK, MILK, BOOST] },
  { slug: "banana-oat", name: "Банан-овсянка", cat: "smoothies", price: 30000, photo: "1685967836529-b0e8d6938227", vol: 300, cal: 290, p: 8, c: 52, f: 5, allergens: ["milk", "gluten"],
    desc: "Банан, овсяные хлопья, молоко, мёд и корица. Сытный, подойдёт вместо завтрака.", mods: [SIZE_DRINK, MILK, BOOST] },
  { slug: "peanut-protein", name: "Арахис-протеин", cat: "smoothies", price: 38000, photo: "1712056407284-c1eda76e7bcd", vol: 300, cal: 360, p: 26, c: 34, f: 12, allergens: ["milk", "peanut"], protein: true,
    desc: "Банан, арахисовая паста, протеин и молоко. После тренировки или вместо обеда.", mods: [SIZE_DRINK, MILK, BOOST] },
  { slug: "mango-coconut", name: "Манго-кокос", cat: "smoothies", price: 34000, photo: "1604298331663-de303fbc7059", vol: 300, cal: 250, p: 2, c: 42, f: 9, vegan: true,
    desc: "Манго, кокосовое молоко и маракуйя. Без молочных продуктов.", mods: [SIZE_DRINK, BOOST] },

  // ---------- Фреши и соки ----------
  { slug: "fresh-orange", name: "Апельсиновый фреш", cat: "fresh", price: 28000, photo: "1600271886742-f049cd451bba", vol: 300, cal: 150, p: 2, c: 34, f: 0, vegan: true, sugarFree: true, prep: 2,
    desc: "Свежевыжатый апельсиновый сок. Только апельсины, без сахара и воды.", mods: [SIZE_FRESH] },
  { slug: "carrot-apple-ginger", name: "Морковь, яблоко, имбирь", cat: "fresh", price: 28000, photo: "1555940726-1c297abcc1f1", vol: 300, cal: 130, p: 2, c: 29, f: 0, vegan: true, sugarFree: true, prep: 2,
    desc: "Морковь и яблоко с кусочком имбиря. Мягкий, тёплый вкус.", mods: [SIZE_FRESH] },
  { slug: "fresh-pomegranate", name: "Гранатовый фреш", cat: "fresh", price: 36000, photo: "1602860637860-fa3d04533a07", vol: 300, cal: 160, p: 1, c: 38, f: 0, vegan: true, sugarFree: true, prep: 3,
    desc: "Сок спелого граната. Терпкий, насыщенный, без добавок.", mods: [SIZE_FRESH] },
  { slug: "fresh-apple", name: "Яблочный фреш", cat: "fresh", price: 26000, photo: "1587015990127-424b954e38b5", vol: 300, cal: 140, p: 0, c: 33, f: 0, vegan: true, sugarFree: true, prep: 2,
    desc: "Свежевыжатый яблочный сок из сочных сортов.", mods: [SIZE_FRESH] },
  { slug: "fresh-grapefruit", name: "Грейпфрутовый фреш", cat: "fresh", price: 30000, photo: "1605002619338-0ed11beb1485", vol: 300, cal: 120, p: 2, c: 28, f: 0, vegan: true, sugarFree: true, prep: 2,
    desc: "Розовый грейпфрут, чуть горьковатый и бодрящий.", mods: [SIZE_FRESH] },
  { slug: "mint-lemonade", name: "Лимонад мята-лайм", cat: "fresh", price: 24000, photo: "1620400183452-c6e4c7933bd3", vol: 400, cal: 90, p: 0, c: 22, f: 0, vegan: true, prep: 2,
    desc: "Лайм, мята и лёд. Подслащён мёдом, газа нет.", mods: [] },

  // ---------- Детокс ----------
  { slug: "green-detox", name: "Грин детокс", cat: "detox", price: 30000, photo: "1631308491952-040f80133535", vol: 300, cal: 110, p: 3, c: 24, f: 1, vegan: true, sugarFree: true,
    desc: "Шпинат, сельдерей, огурец, яблоко и лимон. Холодный отжим без сахара.", mods: [SIZE_FRESH] },
  { slug: "celery-cucumber", name: "Сельдерей-огурец", cat: "detox", price: 28000, photo: "1628751584748-0d780bad3f06", vol: 300, cal: 70, p: 2, c: 14, f: 0, vegan: true, sugarFree: true,
    desc: "Сельдерей, огурец, зелёное яблоко и мята. Самый лёгкий напиток в меню.", mods: [SIZE_FRESH] },
  { slug: "ginger-shot", name: "Имбирный шот", cat: "detox", price: 14000, photo: "1682530016814-6a1c1311cd6e", vol: 60, cal: 25, p: 0, c: 6, f: 0, vegan: true, sugarFree: true, prep: 1,
    desc: "Имбирь, лимон и немного яблочного сока. Острый, пьётся залпом.", mods: [] },
  { slug: "turmeric-shot", name: "Куркума-лимон шот", cat: "detox", price: 16000, photo: "1631029098074-be99eb2b425c", vol: 60, cal: 30, p: 0, c: 7, f: 0, vegan: true, sugarFree: true, prep: 1,
    desc: "Куркума, лимон, имбирь и щепотка чёрного перца.", mods: [] },
  { slug: "cucumber-mint-water", name: "Вода огурец-мята", cat: "detox", price: 18000, photo: "1622921232837-6ed18e70bc94", vol: 500, cal: 5, p: 0, c: 1, f: 0, vegan: true, sugarFree: true, prep: 1,
    desc: "Вода с огурцом, мятой и лимоном. Без сахара и калорий.", mods: [] },
  { slug: "coconut-water", name: "Кокосовая вода", cat: "detox", price: 26000, photo: "1620752420341-4cd7642568dd", vol: 330, cal: 60, p: 1, c: 14, f: 0, vegan: true, sugarFree: true, prep: 1,
    desc: "Натуральная кокосовая вода, охлаждённая. Хорошо после тренировки.", mods: [] },

  // ---------- Боулы ----------
  { slug: "berry-bowl", name: "Ягодный боул", cat: "bowls", price: 45000, photo: "1672959202028-51e3b71255bd", cal: 380, p: 12, c: 60, f: 9, allergens: ["milk", "gluten"], protein: true, prep: 5,
    desc: "Густой смузи из клубники и банана, сверху йогурт, гранола и чиа. Около 350 г.", mods: [TOPPINGS] },
  { slug: "tropical-bowl", name: "Тропический боул", cat: "bowls", price: 48000, photo: "1684403620650-81dc661a69db", cal: 410, p: 11, c: 66, f: 10, allergens: ["milk", "gluten"], prep: 5,
    desc: "Манго и банан в основе, сверху йогурт, гранола, чиа и кокос. Около 350 г.", mods: [TOPPINGS] },
  { slug: "acai-bowl", name: "Боул с асаи", cat: "bowls", price: 58000, photo: "1627308594190-a057cd4bfac8", cal: 430, p: 9, c: 70, f: 13, allergens: ["gluten"], vegan: true, prep: 5,
    desc: "Асаи с бананом, сверху ягоды, гранола и кокосовая стружка. Без молочных продуктов. Около 380 г.", mods: [TOPPINGS] },
  { slug: "peanut-protein-bowl", name: "Протеиновый боул", cat: "bowls", price: 52000, photo: "1654923064926-be7e64267a31", cal: 480, p: 30, c: 52, f: 16, allergens: ["milk", "gluten", "peanut"], protein: true, prep: 5,
    desc: "Банан, протеин и арахисовая паста, сверху гранола и ломтики банана. Около 360 г.", mods: [TOPPINGS] },
  { slug: "quinoa-avocado-bowl", name: "Боул с киноа и авокадо", cat: "bowls", price: 55000, photo: "1763000215238-38350d3e41ac", cal: 520, p: 16, c: 54, f: 26, allergens: ["sesame"], vegan: true, prep: 6,
    desc: "Киноа, авокадо, нут, огурец, помидоры черри и лимонный соус. Около 380 г.", mods: [SALAD_ADD] },
  { slug: "chicken-quinoa-bowl", name: "Боул с курицей и киноа", cat: "bowls", price: 58000, photo: "1759429179911-4e1f0e4e69f7", cal: 560, p: 38, c: 52, f: 20, allergens: ["sesame"], protein: true, prep: 6,
    desc: "Курица гриль, киноа, свежие овощи, эдамаме и соус терияки. Около 400 г.", mods: [SALAD_ADD] },

  // ---------- Салаты ----------
  { slug: "greek-salad", name: "Греческий салат", cat: "salads", price: 42000, photo: "1607532941433-304659e8198a", cal: 280, p: 9, c: 14, f: 21, allergens: ["milk"], sugarFree: true, prep: 4,
    desc: "Помидоры, огурцы, перец, оливки, красный лук и фета с оливковым маслом. Около 300 г.", mods: [SALAD_ADD] },
  { slug: "chicken-avocado-salad", name: "Салат с курицей и авокадо", cat: "salads", price: 52000, photo: "1761315600943-d8a5bb0c499f", cal: 430, p: 34, c: 14, f: 28, allergens: ["egg"], protein: true, sugarFree: true, prep: 5,
    desc: "Курица гриль, авокадо, помидоры, листья салата и яйцо. Заправка из лимона и оливкового масла. Около 320 г.", mods: [SALAD_ADD] },
  { slug: "quinoa-chickpea-salad", name: "Салат с киноа и нутом", cat: "salads", price: 44000, photo: "1623428187969-5da2dcea5ebf", cal: 390, p: 15, c: 52, f: 14, vegan: true, prep: 4,
    desc: "Киноа, нут, печёный перец, огурец и зелень. Лёгкая заправка с лимоном. Около 300 г.", mods: [SALAD_ADD] },
  { slug: "pumpkin-arugula-salad", name: "Салат с тыквой и рукколой", cat: "salads", price: 42000, photo: "1505576633757-0ac1084af824", cal: 310, p: 8, c: 30, f: 18, allergens: ["sesame"], vegan: true, prep: 4,
    desc: "Печёная тыква, руккола, тыквенные семечки и бальзамический соус. Около 280 г.", mods: [SALAD_ADD] },

  // ---------- Перекусы ----------
  { slug: "granola-cup", name: "Гранола в стаканчике", cat: "healthy-snacks", price: 18000, photo: "1668723968333-28fff638eecd", cal: 320, p: 8, c: 48, f: 11, allergens: ["gluten", "nuts"], vegan: true, prep: 1,
    desc: "Хрустящая гранола с орехами и мёдом. 100 г.", mods: [] },
  { slug: "yogurt-parfait", name: "Йогурт с гранолой и ягодами", cat: "healthy-snacks", price: 26000, photo: "1654584240523-6b8d3f6c33b4", cal: 290, p: 11, c: 38, f: 10, allergens: ["milk", "gluten"], prep: 2,
    desc: "Натуральный йогурт слоями с гранолой и ягодами. 220 г.", mods: [] },
  { slug: "mango-chia-pudding", name: "Чиа-пудинг с манго", cat: "healthy-snacks", price: 30000, photo: "1552528352-59648b345866", cal: 270, p: 7, c: 34, f: 12, vegan: true, prep: 2,
    desc: "Чиа на кокосовом молоке, сверху пюре из манго. 200 г.", mods: [] },
  { slug: "nut-mix", name: "Микс орехов", cat: "healthy-snacks", price: 24000, photo: "1543158181-1274e5362710", cal: 330, p: 10, c: 12, f: 28, allergens: ["nuts"], vegan: true, sugarFree: true, prep: 1,
    desc: "Миндаль, грецкий орех, кешью и немного кураги. 60 г.", mods: [] },
  { slug: "hummus-veggies", name: "Хумус с овощами", cat: "healthy-snacks", price: 28000, photo: "1683725519288-eab9fa352335", cal: 260, p: 9, c: 28, f: 13, allergens: ["sesame"], vegan: true, prep: 2,
    desc: "Домашний хумус, морковь, огурец и сладкий перец. 200 г.", mods: [] },

  // ---------- Фрукты ----------
  { slug: "fruit-cup", name: "Фруктовый стакан", cat: "fruits", price: 25000, photo: "1564093497595-593b96d80180", cal: 140, p: 2, c: 34, f: 0, vegan: true, sugarFree: true, prep: 3,
    desc: "Нарезка из яблока, апельсина, киви и сезонных фруктов. 250 г.", mods: [] },
  { slug: "fruit-platter", name: "Фруктовая тарелка", cat: "fruits", price: 55000, photo: "1523033904333-243d0283acae", cal: 320, p: 4, c: 78, f: 1, vegan: true, sugarFree: true, prep: 5,
    desc: "Большая нарезка из 6–7 фруктов и ягод, хватит на двоих. 600 г.", mods: [] },
  { slug: "pomegranate-cup", name: "Гранат очищенный", cat: "fruits", price: 30000, photo: "1654648742474-7f22ca616d0b", cal: 180, p: 3, c: 40, f: 2, vegan: true, sugarFree: true, prep: 2,
    desc: "Зёрна спелого граната без плёнок. 200 г.", mods: [] },

  // ---------- Сеты ----------
  { slug: "set-breakfast", name: "Сет «Завтрак»", cat: "sets", price: 65000, photo: "1621797350488-fb28c9217e3b", cal: 530, p: 14, c: 94, f: 9, allergens: ["milk", "gluten"], prep: 6,
    desc: "Ягодный боул и апельсиновый фреш 300 мл. Выгоднее, чем по отдельности, на 8 000 сум.", mods: [] },
  { slug: "set-lunch", name: "Сет «Обед»", cat: "sets", price: 79000, photo: "1759429179911-4e1f0e4e69f7", cal: 720, p: 41, c: 86, f: 21, allergens: ["sesame"], protein: true, prep: 7,
    desc: "Боул с курицей и киноа и смузи «Зелёный заряд» 300 мл. Выгоднее на 9 000 сум.", mods: [] },
  { slug: "set-detox-day", name: "Сет «Детокс-день»", cat: "sets", price: 55000, photo: "1631308491952-040f80133535", cal: 145, p: 3, c: 31, f: 1, vegan: true, sugarFree: true, prep: 4,
    desc: "Грин детокс 300 мл, имбирный шот и вода огурец-мята. Выгоднее на 7 000 сум.", mods: [] },
  { slug: "set-for-two", name: "Сет «Для двоих»", cat: "sets", price: 99000, photo: "1564093497595-593b96d80180", cal: 780, p: 16, c: 160, f: 6, allergens: ["milk"], prep: 8,
    desc: "Два смузи 300 мл на выбор бариста и фруктовая тарелка. Выгоднее на 20 000 сум.", mods: [] },
];

export async function seedMenu(prisma: PrismaClient, log: (s: string) => void = console.log) {
  const catId: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const found = (await prisma.category.findUnique({ where: { slug: c.slug } })) ?? (await prisma.category.findUnique({ where: { name: c.name } }));
    catId[c.slug] = found ? found.id : (await prisma.category.create({ data: { slug: c.slug, name: c.name, sort: i } })).id;
  }
  let created = 0;
  let skipped = 0;
  for (const m of MENU) {
    if (await prisma.product.findUnique({ where: { slug: m.slug } })) { skipped++; continue; }
    await prisma.product.create({
      data: {
        slug: m.slug, name: m.name, description: m.desc, categoryId: catId[m.cat], price: m.price, image: img(m.photo),
        calories: m.cal, protein: m.p, carbs: m.c, fat: m.f, volumeMl: m.vol ?? null, prepMinutes: m.prep ?? 3,
        allergens: m.allergens ?? [], isVegan: !!m.vegan, isHighProtein: !!m.protein, isSugarFree: !!m.sugarFree,
        modifiers: {
          create: (m.mods ?? []).map((mod) => ({
            name: mod.name, multiple: mod.multiple, required: mod.required,
            options: { create: mod.options.map(([name, priceDelta, recipeMultiplier]) => ({ name, priceDelta, recipeMultiplier: recipeMultiplier ?? 1 })) },
          })),
        },
      },
    });
    created++;
  }
  // Напиткам, которые уже есть в базе, добавляем «Лёд» и «Сладость», если их ещё нет (повторный запуск ничего не дублирует).
  let extras = 0;
  const drinks = await prisma.product.findMany({ where: { category: { slug: { in: DRINK_CATEGORIES } } }, include: { modifiers: { select: { name: true } } } });
  for (const p of drinks) {
    for (const mod of [ICE, SUGAR]) {
      if (p.modifiers.some((x) => x.name === mod.name)) continue;
      await prisma.modifier.create({ data: { productId: p.id, name: mod.name, multiple: mod.multiple, required: mod.required, options: { create: mod.options.map(([name, priceDelta]) => ({ name, priceDelta, recipeMultiplier: 1 })) } } });
      extras++;
    }
  }
  log(`MENU: добавлено ${created}, уже было ${skipped}, категорий ${CATEGORIES.length}, пожеланий к напиткам ${extras}`);
  return { created, skipped, extras };
}
