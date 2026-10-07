/**
 * Добавляет в базу расширенное меню (категории, позиции, опции, фото).
 * Существующие позиции не меняются, поэтому скрипт можно запускать повторно.
 *
 *   npx tsx prisma/seed-menu.ts
 */
import { PrismaClient } from "@prisma/client";
import { seedMenu } from "./menu-seed";

const prisma = new PrismaClient();
seedMenu(prisma)
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
