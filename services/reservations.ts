import { z } from "zod";
import { Prisma, type Role, type ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getSettingValues } from "@/services/settings";
import { normalizePhone } from "@/services/pos";
import { ACTIVE_STATUSES, checkWhen, overlaps, pickTable, slotTimes, toUtc, type Busy } from "@/lib/booking";
import { hhmm } from "@/lib/happy-hour";
import { TZ_OFFSET_MS } from "@/lib/time";

type Actor = { id: string; role: Role; locationId: string | null };

export async function bookingConfig() {
  const v = await getSettingValues();
  return {
    enabled: v["booking.enabled"] === 1, autoConfirm: v["booking.autoConfirm"] === 1, depositPerGuest: v["booking.depositPerGuest"],
    durationMin: v["booking.durationMin"], openHour: v["booking.openHour"], closeHour: Math.max(v["booking.closeHour"], v["booking.openHour"]),
    maxGuests: v["booking.maxGuests"], leadMin: v["booking.leadMinutes"], maxDays: v["booking.maxDays"],
  };
}
export type BookingConfig = Awaited<ReturnType<typeof bookingConfig>>;

const dayRange = (day: string) => {
  const start = toUtc(day, "00:00");
  if (start == null) throw new ApiError(400, "Некорректная дата");
  return { gte: new Date(start), lt: new Date(start + 86400000) };
};

async function busyFor(db: Pick<typeof prisma, "reservation">, locationId: string, fromMs: number, toMs: number, excludeId?: string): Promise<Busy[]> {
  const rows = await db.reservation.findMany({
    where: { locationId, status: { in: [...ACTIVE_STATUSES] }, startsAt: { gte: new Date(fromMs - 12 * 3600000), lt: new Date(toMs) }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { tableId: true, startsAt: true, durationMin: true },
  });
  return rows.map((r) => ({ tableId: r.tableId, startsAt: r.startsAt.getTime(), durationMin: r.durationMin }));
}

/** Время на выбор: свободно ли в каждый слот хотя бы за одним столом нужной вместимости. */
export async function freeSlots(locationId: string, day: string, guests: number, now = Date.now()) {
  const cfg = await bookingConfig();
  const tables = await prisma.diningTable.findMany({ where: { locationId, isActive: true }, select: { id: true, number: true, seats: true } });
  const dayStart = toUtc(day, "00:00");
  if (dayStart == null) throw new ApiError(400, "Некорректная дата");
  const busy = await busyFor(prisma, locationId, dayStart, dayStart + 2 * 86400000);
  return slotTimes(cfg.openHour, cfg.closeHour).map((time) => {
    const at = toUtc(day, time)!;
    const when = checkWhen(at, now, cfg.leadMin, cfg.maxDays);
    const free = when.ok && !!pickTable(tables, busy, { startsAt: at, durationMin: cfg.durationMin }, guests);
    return { time, free };
  });
}

const base = {
  name: z.string().trim().min(2, "Введите имя").max(60, "Имя слишком длинное"),
  phone: z.string().trim().min(1, "Введите телефон"),
  guests: z.coerce.number({ error: "Укажите число гостей" }).int("Число гостей — целое").min(1, "Минимум 1 гость").max(100),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Выберите дату"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Выберите время"),
  note: z.string().trim().max(300, "Комментарий слишком длинный").optional(),
};
export const webBookingSchema = z.object(base);
export const staffBookingSchema = z.object({ ...base, tableId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()), confirm: z.boolean().default(true) });

/** Создаёт бронь и сразу подбирает стол. Параллельные брони на один стол исключены блокировкой по точке. */
export async function createReservation(input: unknown, locationId: string | null, opts: { staff?: Actor; now?: number } = {}) {
  const now = opts.now ?? Date.now();
  const staff = opts.staff;
  const d = (staff ? staffBookingSchema : webBookingSchema).parse(input) as z.infer<typeof staffBookingSchema>;
  if (!locationId) throw new ApiError(400, "Выберите точку");
  const cfg = await bookingConfig();
  if (!staff && !cfg.enabled) throw new ApiError(400, "Онлайн-бронь сейчас недоступна. Позвоните в заведение.");
  if (!staff && d.guests > cfg.maxGuests) throw new ApiError(400, `Онлайн можно забронировать до ${cfg.maxGuests} гостей. Для большой компании позвоните в заведение.`);
  const phone = normalizePhone(d.phone);
  if (!phone) throw new ApiError(400, "Введите телефон в формате +998 90 123 45 67");
  const startsAt = toUtc(d.day, d.time);
  if (startsAt == null) throw new ApiError(400, "Некорректные дата или время");
  if (staff) { if (startsAt < now - 3600000) throw new ApiError(400, "Нельзя внести бронь на прошедшее время"); }
  else {
    const w = checkWhen(startsAt, now, cfg.leadMin, cfg.maxDays);
    if (!w.ok) throw new ApiError(400, w.error);
    const m = Math.round((startsAt + TZ_OFFSET_MS) / 60000) % 1440;
    if (m < cfg.openHour * 60 || m > cfg.closeHour * 60) throw new ApiError(400, `Бронь принимается с ${hhmm(cfg.openHour * 60)} до ${hhmm(cfg.closeHour * 60)}`);
    const active = await prisma.reservation.count({ where: { phone, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gte: new Date(now) } } });
    if (active >= 3) throw new ApiError(400, "У вас уже есть несколько активных броней. Позвоните в заведение, если нужно больше.");
  }
  if (!(await prisma.location.findFirst({ where: { id: locationId, isActive: true } }))) throw new ApiError(400, "Эта точка сейчас не принимает брони");
  const customer = await prisma.customer.findUnique({ where: { phone }, select: { id: true } });
  const deposit = cfg.depositPerGuest * d.guests;
  const slot = { startsAt, durationMin: cfg.durationMin };

  const r = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"reservation:" + locationId}))`);
    const tables = await tx.diningTable.findMany({ where: { locationId, isActive: true }, select: { id: true, number: true, seats: true } });
    if (tables.length === 0) throw new ApiError(400, "В заведении нет столов для брони. Позвоните нам.");
    const busy = await busyFor(tx, locationId, startsAt, startsAt + cfg.durationMin * 60000);
    let table = null as (typeof tables)[number] | null;
    if (staff && d.tableId) {
      table = tables.find((t) => t.id === d.tableId) ?? null;
      if (!table) throw new ApiError(400, "Стол не найден");
      if (table.seats < d.guests) throw new ApiError(400, `За столом ${table.number} только ${table.seats} мест`);
      if (busy.some((b) => b.tableId === table!.id && overlaps(slot, b))) throw new ApiError(409, `Стол ${table.number} на это время уже занят`);
    } else {
      table = pickTable(tables, busy, slot, d.guests);
      if (!table) throw new ApiError(409, `На это время нет свободного стола для ${d.guests} гост. Выберите другое время.`);
    }
    return tx.reservation.create({
      data: {
        locationId, tableId: table.id, customerId: customer?.id ?? null, name: d.name, phone, guests: d.guests, startsAt: new Date(startsAt), durationMin: cfg.durationMin,
        status: staff ? (d.confirm ? "CONFIRMED" : "PENDING") : cfg.autoConfirm ? "CONFIRMED" : "PENDING",
        note: d.note || null, deposit, source: staff ? "STAFF" : "WEB",
      },
      include: { table: { select: { number: true } } },
    });
  }, { timeout: 15000, maxWait: 10000 });
  await audit({ userId: staff?.id, action: "RESERVATION_CREATED", entity: "Reservation", entityId: r.id, newValue: { guests: d.guests, startsAt: r.startsAt.toISOString(), table: r.table?.number ?? null, status: r.status, source: r.source } });
  return r;
}

export type ReservationRow = Awaited<ReturnType<typeof listReservations>>[number];
export async function listReservations(locationId: string | null, day: string) {
  const rows = await prisma.reservation.findMany({
    where: { ...(locationId ? { locationId } : {}), startsAt: dayRange(day) }, orderBy: { startsAt: "asc" },
    include: { table: { select: { number: true, seats: true } }, location: { select: { name: true } } },
  });
  return rows.map((r) => ({ ...r, deposit: Number(r.deposit) }));
}

/** Ближайшие брони для зала: от «сейчас минус час» до конца суток. */
export async function upcomingReservations(locationId: string, now = Date.now()) {
  const dayStart = toUtc(new Date(now + TZ_OFFSET_MS).toISOString().slice(0, 10), "00:00")!;
  const rows = await prisma.reservation.findMany({
    where: { locationId, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gte: new Date(now - 3600000), lt: new Date(dayStart + 86400000) } },
    orderBy: { startsAt: "asc" }, include: { table: { select: { id: true, number: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, guests: r.guests, startsAt: r.startsAt, tableId: r.table?.id ?? null, tableNumber: r.table?.number ?? null, status: r.status, deposit: Number(r.deposit), depositPaid: r.depositPaid }));
}

const FLOW: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ["CONFIRMED", "SEATED", "CANCELLED"],
  CONFIRMED: ["SEATED", "NO_SHOW", "CANCELLED"],
  SEATED: [], CANCELLED: [], NO_SHOW: [],
};
export const canMove = (from: ReservationStatus, to: ReservationStatus) => FLOW[from].includes(to);

export async function setReservationStatus(id: string, to: ReservationStatus, user: Actor) {
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r) throw new ApiError(404, "Бронь не найдена");
  if (user.locationId && r.locationId !== user.locationId && user.role !== "OWNER" && user.role !== "ADMIN") throw new ApiError(403, "Бронь другой точки");
  if (!canMove(r.status, to)) throw new ApiError(400, "Этот статус сейчас выставить нельзя");
  const u = await prisma.reservation.updateMany({ where: { id, status: r.status }, data: { status: to } });
  if (u.count === 0) throw new ApiError(409, "Бронь уже изменили. Обновите страницу.");
  await audit({ userId: user.id, action: "RESERVATION_STATUS", entity: "Reservation", entityId: id, oldValue: { status: r.status }, newValue: { status: to } });
}

export async function assignReservationTable(id: string, tableId: string, user: Actor) {
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r) throw new ApiError(404, "Бронь не найдена");
  if (!(ACTIVE_STATUSES as readonly string[]).includes(r.status)) throw new ApiError(400, "Бронь уже закрыта");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"reservation:" + r.locationId}))`);
    const t = await tx.diningTable.findFirst({ where: { id: tableId, locationId: r.locationId, isActive: true } });
    if (!t) throw new ApiError(404, "Стол не найден");
    if (t.seats < r.guests) throw new ApiError(400, `За столом ${t.number} только ${t.seats} мест`);
    const busy = await busyFor(tx, r.locationId, r.startsAt.getTime(), r.startsAt.getTime() + r.durationMin * 60000, id);
    if (busy.some((b) => b.tableId === tableId && overlaps({ startsAt: r.startsAt.getTime(), durationMin: r.durationMin }, b))) throw new ApiError(409, `Стол ${t.number} на это время уже занят`);
    await tx.reservation.update({ where: { id }, data: { tableId } });
  });
  await audit({ userId: user.id, action: "RESERVATION_TABLE", entity: "Reservation", entityId: id, oldValue: { tableId: r.tableId }, newValue: { tableId } });
}

export async function setDepositPaid(id: string, paid: boolean, user: Actor) {
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r) throw new ApiError(404, "Бронь не найдена");
  if (Number(r.deposit) <= 0) throw new ApiError(400, "У этой брони нет депозита");
  await prisma.reservation.update({ where: { id }, data: { depositPaid: paid } });
  await audit({ userId: user.id, action: "RESERVATION_DEPOSIT", entity: "Reservation", entityId: id, oldValue: { depositPaid: r.depositPaid }, newValue: { depositPaid: paid, deposit: Number(r.deposit) } });
}

/** Страница брони для гостя: открывается по длинному id из ссылки. */
export async function getPublicReservation(id: string) {
  if (!/^[a-z0-9]{20,40}$/.test(id)) return null;
  const r = await prisma.reservation.findUnique({ where: { id }, include: { location: { select: { name: true, address: true, phone: true } }, table: { select: { number: true } } } });
  return r ? { ...r, deposit: Number(r.deposit) } : null;
}

export async function cancelByGuest(id: string, now = Date.now()) {
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r) throw new ApiError(404, "Бронь не найдена");
  if (r.status !== "PENDING" && r.status !== "CONFIRMED") throw new ApiError(400, "Эту бронь уже нельзя отменить");
  if (r.startsAt.getTime() < now) throw new ApiError(400, "Время брони уже прошло");
  await prisma.reservation.updateMany({ where: { id, status: r.status }, data: { status: "CANCELLED" } });
  await audit({ action: "RESERVATION_CANCELLED_BY_GUEST", entity: "Reservation", entityId: id });
}
