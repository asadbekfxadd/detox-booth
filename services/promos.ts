import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

type Actor = { id: string; role: Role; locationId: string | null };
const blank = (v: unknown) => (v === "" || v == null ? undefined : v);
async function safeAudit(p: Parameters<typeof audit>[0]) {
  try { await audit(p); } catch (e) { console.error("[AUDIT ERROR]", e); }
}

export async function listPromos() {
  const rows = await prisma.promoCode.findMany({ orderBy: [{ isActive: "desc" }, { code: "asc" }] });
  const now = new Date();
  return rows.map((p) => ({
    id: p.id, code: p.code, type: p.type, value: Number(p.value), minOrder: Number(p.minOrder), usageLimit: p.usageLimit, usedCount: p.usedCount,
    expiresAt: p.expiresAt, isActive: p.isActive, expired: !!p.expiresAt && p.expiresAt < now, exhausted: p.usageLimit != null && p.usedCount >= p.usageLimit,
  }));
}

export const promoSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, "Код: 3–20 символов, латиница, цифры, - или _"),
  type: z.enum(["PERCENT", "FIXED"], { error: "Выберите тип скидки" }),
  value: z.coerce.number({ error: "Укажите размер скидки" }).positive("Размер скидки должен быть больше 0").max(1_000_000_000),
  minOrder: z.preprocess(blank, z.coerce.number().min(0, "Минимальная сумма не может быть отрицательной").max(1_000_000_000).default(0)),
  usageLimit: z.preprocess(blank, z.coerce.number().int("Лимит — целое число").min(1, "Лимит должен быть не меньше 1").max(1_000_000).optional()),
  expiresAt: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата").optional()),
}).refine((d) => d.type !== "PERCENT" || d.value <= 100, { message: "Процент не может быть больше 100", path: ["value"] });

export async function createPromo(input: unknown, user: Actor) {
  const d = promoSchema.parse(input);
  if (await prisma.promoCode.findFirst({ where: { code: { equals: d.code, mode: "insensitive" } } })) throw new ApiError(400, "Такой промокод уже есть");
  const p = await prisma.promoCode.create({ data: {
    code: d.code, type: d.type, value: d.value, minOrder: d.minOrder, usageLimit: d.usageLimit ?? null,
    expiresAt: d.expiresAt ? new Date(`${d.expiresAt}T23:59:59+05:00`) : null,
  } });
  await safeAudit({ userId: user.id, action: "PROMO_CREATED", entity: "PromoCode", entityId: p.id, newValue: { code: p.code, type: d.type, value: d.value, minOrder: d.minOrder, usageLimit: d.usageLimit ?? null, expiresAt: d.expiresAt ?? null } });
}

export async function setPromoActive(id: string, isActive: boolean, user: Actor) {
  const p = await prisma.promoCode.findUnique({ where: { id } });
  if (!p) throw new ApiError(404, "Промокод не найден");
  await prisma.promoCode.update({ where: { id }, data: { isActive } });
  await safeAudit({ userId: user.id, action: "PROMO_TOGGLED", entity: "PromoCode", entityId: id, oldValue: { isActive: p.isActive }, newValue: { code: p.code, isActive } });
}

export async function deletePromo(id: string, user: Actor) {
  const p = await prisma.promoCode.findUnique({ where: { id } });
  if (!p) throw new ApiError(404, "Промокод не найден");
  if (p.usedCount > 0) throw new ApiError(400, "Использованный промокод удалить нельзя — отключите его");
  await prisma.promoCode.delete({ where: { id } });
  await safeAudit({ userId: user.id, action: "PROMO_DELETED", entity: "PromoCode", entityId: id, oldValue: { code: p.code } });
}
