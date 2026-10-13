/**
 * Первый запуск для нового заведения. Ничего не стирает: создаёт владельца, одну точку и бренд.
 * Нужны переменные: BLANK_OWNER_EMAIL, BLANK_OWNER_PASSWORD (не короче 12 знаков), по желанию BLANK_BRAND_NAME и BLANK_LOCATION_NAME.
 * Запуск: npx tsx prisma/seed-blank.ts
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { BLANK_BRAND, parseBrand } from "../lib/brand-config";

const prisma = new PrismaClient();
const need = (k: string) => { const v = process.env[k]?.trim(); if (!v) throw new Error(`Задайте ${k}`); return v; };

async function main() {
  if ((await prisma.user.count()) > 0) throw new Error("В базе уже есть сотрудники. Первый запуск нужен только для пустой базы.");
  const email = need("BLANK_OWNER_EMAIL").toLowerCase();
  const password = need("BLANK_OWNER_PASSWORD");
  if (password.length < 12) throw new Error("BLANK_OWNER_PASSWORD: не короче 12 знаков");
  const brandName = process.env.BLANK_BRAND_NAME?.trim() || BLANK_BRAND.name;
  const brand = parseBrand({ ...BLANK_BRAND, name: brandName, ticker: "" });
  await prisma.$transaction([
    prisma.location.create({ data: { name: process.env.BLANK_LOCATION_NAME?.trim() || "Основная точка" } }),
    prisma.user.create({ data: { role: "OWNER", email, name: "Владелец", passwordHash: await hash(password, 12) } }),
    prisma.setting.upsert({ where: { key: "brand" }, create: { key: "brand", value: brand }, update: { value: brand } }),
  ]);
  console.log(`Готово. Войдите как ${email}, затем заполните «Бренд и сайт», добавьте точку, категории и меню.`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).finally(() => prisma.$disconnect());
