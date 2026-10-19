import { prisma } from "@/lib/prisma";
import { MIX_PRODUCT_SLUG } from "@/lib/mix";

export type GuideStep = { id: string; title: string; help: string; href: string; action: string; done: boolean; progress?: string };

/** Шаги «С чего начать»: что нужно заполнить, чтобы система считала склад, себестоимость и прибыль верно. Галочки ставятся сами по данным. */
export async function getStartGuide(): Promise<GuideStep[]> {
  const [locs, products, withRecipe, stocked, employees, shifts, expenses] = await Promise.all([
    prisma.location.findMany({ where: { isActive: true }, select: { address: true, phone: true } }),
    prisma.product.count({ where: { isArchived: false, slug: { not: MIX_PRODUCT_SLUG } } }),
    prisma.recipe.count({ where: { items: { some: {} }, product: { isArchived: false } } }),
    prisma.stockItem.count({ where: { quantity: { gt: 0 } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.shift.count(),
    prisma.expense.count(),
  ]);
  const contactsDone = locs.length > 0 && locs.every((l) => !!l.address?.trim() && !!l.phone?.trim());
  return [
    { id: "contacts", title: "Укажите адрес и телефон заведения", help: "Их увидят гости на сайте. Если заданы координаты, на сайте появится карта.", href: "/admin/settings#locations", action: "Заполнить", done: contactsDone },
    { id: "menu", title: "Проверьте меню: цены и фото", help: "Продукты, которые видят гости на сайте и кассир на кассе.", href: "/admin/products", action: "Открыть меню", done: products > 0 },
    { id: "stock", title: "Оприходуйте продукты на склад", help: "Склад → «+ Приход»: вводите количество в кг, л или штуках и цену закупки. Без этого система не знает остатков и себестоимости.", href: "/admin/inventory/receive", action: "Сделать приход", done: stocked > 0 },
    { id: "recipes", title: "Составьте рецепты", help: "Рецепт говорит системе, сколько продуктов уходит на одну порцию: по нему списывается склад и считается прибыль.", href: "/admin/recipes", action: "Рецепты", done: products > 0 && withRecipe >= products, progress: `рецепты есть у ${withRecipe} из ${products}` },
    { id: "staff", title: "Добавьте сотрудников", help: "Кассиров, официантов, курьеров: у каждого свой вход и своя роль, лишнего они не увидят.", href: "/admin/employees", action: "Сотрудники", done: employees > 1 },
    { id: "expenses", title: "Внесите расходы: аренда, коммунальные, маркетинг", help: "Нужны, чтобы видеть чистую прибыль, а не только выручку.", href: "/admin/finance#expense", action: "Добавить расход", done: expenses > 0 },
    { id: "shift", title: "Откройте смену на кассе и пробейте первый заказ", help: "Кассир открывает смену с суммой наличных в кассе, дальше продаёт и в конце дня закрывает смену.", href: "/pos", action: "Открыть кассу", done: shifts > 0 },
  ];
}
