/**
 * Проверяет, что фото всех позиций открываются. Выводит список «битых» ссылок.
 *
 *   npx tsx prisma/check-images.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.product.findMany({ where: { image: { not: null } }, select: { name: true, slug: true, image: true } });
  const bad: string[] = [];
  for (const r of rows) {
    try {
      const res = await fetch(r.image!, { method: "HEAD" });
      if (!res.ok) bad.push(`${res.status}  ${r.name} (${r.slug})`);
    } catch {
      bad.push(`нет ответа  ${r.name} (${r.slug})`);
    }
  }
  console.log(`Проверено фото: ${rows.length}. Не открываются: ${bad.length}`);
  for (const b of bad) console.log(" ", b);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
