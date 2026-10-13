import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { parseHhmm, type HappyRule } from "@/lib/happy-hour";

type Actor = { id: string; role: Role; locationId: string | null };
type Db = Pick<typeof prisma, "happyHour">;

/** Включённые правила для расчёта цен. */
export async function loadRules(db: Db = prisma): Promise<HappyRule[]> {
  const rows = await db.happyHour.findMany({ where: { isActive: true } });
  return rows.map((r) => ({ id: r.id, name: r.name, percent: r.percent, days: r.days, startMin: r.startMin, endMin: r.endMin, categoryId: r.categoryId }));
}

export const listHappyHours = () => prisma.happyHour.findMany({ orderBy: [{ isActive: "desc" }, { startMin: "asc" }], include: { category: { select: { name: true } } } });

const time = (label: string) => z.string().transform((v, ctx) => { const m = parseHhmm(v); if (m == null) ctx.addIssue({ code: "custom", message: `${label}: время в формате 16:00` }); return m ?? 0; });
export const happySchema = z.object({
  name: z.string().trim().min(2, "Введите название").max(60, "Название слишком длинное"),
  percent: z.coerce.number({ error: "Укажите скидку" }).int("Скидка — целое число").min(1, "Скидка от 1%").max(90, "Скидка не больше 90%"),
  days: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Выберите хотя бы один день"),
  start: time("Начало"),
  end: time("Конец"),
  categoryId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
}).refine((d) => d.end > d.start, { message: "Конец должен быть позже начала. Если акция идёт через полночь, создайте два правила.", path: ["end"] });

export async function createHappyHour(input: unknown, user: Actor) {
  const d = happySchema.parse(input);
  if (d.categoryId && !(await prisma.category.findUnique({ where: { id: d.categoryId } }))) throw new ApiError(400, "Категория не найдена");
  const h = await prisma.happyHour.create({ data: { name: d.name, percent: d.percent, days: [...new Set(d.days)].sort(), startMin: d.start, endMin: d.end, categoryId: d.categoryId ?? null } });
  await audit({ userId: user.id, action: "HAPPY_CREATED", entity: "HappyHour", entityId: h.id, newValue: { name: d.name, percent: d.percent, days: h.days, start: d.start, end: d.end, categoryId: d.categoryId ?? null } });
}

export async function setHappyActive(id: string, isActive: boolean, user: Actor) {
  const h = await prisma.happyHour.findUnique({ where: { id } });
  if (!h) throw new ApiError(404, "Правило не найдено");
  await prisma.happyHour.update({ where: { id }, data: { isActive } });
  await audit({ userId: user.id, action: "HAPPY_TOGGLED", entity: "HappyHour", entityId: id, oldValue: { isActive: h.isActive }, newValue: { name: h.name, isActive } });
}

export async function deleteHappyHour(id: string, user: Actor) {
  const h = await prisma.happyHour.findUnique({ where: { id } });
  if (!h) throw new ApiError(404, "Правило не найдено");
  await prisma.happyHour.delete({ where: { id } });
  await audit({ userId: user.id, action: "HAPPY_DELETED", entity: "HappyHour", entityId: id, oldValue: { name: h.name } });
}
