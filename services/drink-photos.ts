import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { drinkPhotoByKey, drinkPhotoUrl, isDrinkCategory, isSmoothieCategory, pickDrinkPhoto } from "@/lib/drink-photos";

type Actor = { id: string; role: Role; locationId: string | null };

export type DrinkRow = { id: string; name: string; category: string; image: string | null; suggestedKey: string; kind: "match" | "fallback" };

/** Напитки меню (не в архиве) и предложенное фото к каждому. */
export async function listDrinkRows(): Promise<DrinkRow[]> {
  const rows = await prisma.product.findMany({
    where: { isArchived: false },
    select: { id: true, name: true, image: true, category: { select: { name: true, slug: true } } },
    orderBy: [{ category: { sort: "asc" } }, { name: "asc" }],
  });
  return rows
    .filter((p) => isDrinkCategory(p.category.name, p.category.slug))
    .map((p) => {
      const pick = pickDrinkPhoto(p.name, isSmoothieCategory(p.category.name, p.category.slug));
      return { id: p.id, name: p.name, category: p.category.name, image: p.image, suggestedKey: pick.photo.key, kind: pick.kind };
    });
}

export const MAX_PHOTO_UPDATES = 200;

/** Применяет выбранные фото. Ключ только из нашей библиотеки: произвольные ссылки сюда не попадают. */
export async function applyDrinkPhotos(input: { productId: string; key: string }[], user: Actor): Promise<number> {
  if (!Array.isArray(input) || input.length === 0) throw new ApiError(400, "Отметьте напитки, которым нужно поставить фото");
  if (input.length > MAX_PHOTO_UPDATES) throw new ApiError(400, `За раз можно не больше ${MAX_PHOTO_UPDATES} напитков`);
  const ids = input.map((i) => i.productId);
  const found = new Map((await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, image: true } })).map((p) => [p.id, p]));
  const changes: { id: string; name: string; from: string | null; to: string }[] = [];
  for (const i of input) {
    const p = found.get(i.productId);
    const photo = drinkPhotoByKey(i.key);
    if (!p) throw new ApiError(404, "Продукт не найден: обновите страницу");
    if (!photo) throw new ApiError(400, "Такого фото нет в библиотеке");
    const to = drinkPhotoUrl(photo);
    if (p.image !== to) changes.push({ id: p.id, name: p.name, from: p.image, to });
  }
  await prisma.$transaction(changes.map((c) => prisma.product.update({ where: { id: c.id }, data: { image: c.to } })));
  if (changes.length) await audit({ userId: user.id, action: "PRODUCT_PHOTOS_APPLIED", entity: "Product", newValue: { count: changes.length, products: changes.map((c) => ({ id: c.id, name: c.name, from: c.from, to: c.to })) } });
  return changes.length;
}
