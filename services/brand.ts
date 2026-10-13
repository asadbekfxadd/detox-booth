import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { BLANK_BRAND, DEFAULT_BRAND, brandFromStored, parseBrand, withNameChange, type Brand } from "@/lib/brand-config";

type Actor = { id: string; role: Role; locationId: string | null };
const KEY = "brand";
const TTL_MS = 20_000;

/** Бренд до первого сохранения в админке. BRAND_PRESET=blank даёт нейтральный бренд для нового заведения. */
const base = (): Brand => (process.env.BRAND_PRESET === "blank" ? BLANK_BRAND : DEFAULT_BRAND);
let memo: { at: number; value: Brand } | null = null;

/** Бренд заведения. Не падает, если базы нет (сборка, сбой): тогда показываем стандартный. */
export const getBrand = cache(async (): Promise<Brand> => {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.value;
  let value = base();
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    value = brandFromStored(row?.value, base());
  } catch { /* остаёмся на стандартном */ }
  memo = { at: Date.now(), value };
  return value;
});

/** Сохраняем бренд из формы. Ошибки проверки (BrandError) пробрасываем наверх с понятным текстом. */
export async function saveBrand(raw: Record<string, unknown>, user: Actor): Promise<boolean> {
  const before = await getBrand();
  const next = withNameChange(parseBrand(raw), before);
  const changed = (Object.keys(next) as (keyof Brand)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(before[k]));
  if (changed.length === 0) return false;
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: next }, update: { value: next } });
  memo = null;
  try { await audit({ userId: user.id, action: "BRAND_CHANGED", entity: "Setting", newValue: { changed } }); } catch (e) { console.error("[AUDIT ERROR]", e); }
  return true;
}
