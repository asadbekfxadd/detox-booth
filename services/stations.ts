import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(2, "Укажите название станции").max(30, "Слишком длинное название"),
  sort: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number({ error: "Порядок — число" }).int("Порядок — целое число").min(0).max(10000)),
});

export const listStations = () => prisma.station.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }], include: { categories: { select: { id: true, name: true }, orderBy: { sort: "asc" } } } });
export const stationOptions = () => prisma.station.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }], select: { id: true, name: true } });

async function assertUniqueName(name: string, exceptId?: string) {
  const dup = await prisma.station.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (dup) throw new ApiError(400, "Станция с таким названием уже есть");
}

export async function createStation(input: unknown, userId: string) {
  const d = schema.parse(input);
  await assertUniqueName(d.name);
  const s = await prisma.station.create({ data: d });
  await audit({ userId, action: "STATION_CREATED", entity: "Station", entityId: s.id, newValue: { name: s.name } });
}

export async function updateStation(id: string, input: unknown, userId: string) {
  const d = schema.parse(input);
  const old = await prisma.station.findUnique({ where: { id } });
  if (!old) throw new ApiError(404, "Станция не найдена");
  await assertUniqueName(d.name, id);
  await prisma.station.update({ where: { id }, data: d });
  await audit({ userId, action: "STATION_UPDATED", entity: "Station", entityId: id, oldValue: { name: old.name }, newValue: { name: d.name } });
}

/** Категории удаляемой станции остаются без станции (их позиции попадут в «Без станции»). */
export async function deleteStation(id: string, userId: string) {
  const s = await prisma.station.findUnique({ where: { id } });
  if (!s) throw new ApiError(404, "Станция не найдена");
  await prisma.station.delete({ where: { id } });
  await audit({ userId, action: "STATION_DELETED", entity: "Station", entityId: id, oldValue: { name: s.name } });
}

/** Привязка категории к станции; пустое значение снимает привязку. */
export async function resolveStationId(raw: unknown): Promise<string | null> {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  if (!(await prisma.station.findUnique({ where: { id: v }, select: { id: true } }))) throw new ApiError(400, "Станция не найдена");
  return v;
}
