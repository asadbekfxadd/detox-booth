import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { parseHhmm } from "@/lib/happy-hour";
import {
  evaluate, inSchedule, scheduleText, describeRule, KIND_LABEL,
  type PromoRule, type CartLine, type EvalResult, type BuyGetConfig, type ComboConfig, type ThresholdConfig, type FirstOrderConfig, type PromoKind, type Applied,
} from "@/lib/promotions";

export type { Applied, Hint, HintFill, CartLine } from "@/lib/promotions";
type Actor = { id: string; role: Role; locationId: string | null };
type Db = Prisma.TransactionClient | typeof prisma;
export type Channel = "SITE" | "POS";

const blank = (v: unknown) => (v === "" || v == null ? undefined : v);

// ───────────── Расчёт для корзины ─────────────
type Row = Prisma.PromotionGetPayload<object>;

async function labelsFor(db: Db, rows: Row[]) {
  const productIds = new Set<string>(), categoryIds = new Set<string>();
  for (const r of rows) {
    if (r.kind === "BUY_GET") { const c = r.config as unknown as BuyGetConfig; c.productIds.forEach((id) => productIds.add(id)); if (c.categoryId) categoryIds.add(c.categoryId); }
    if (r.kind === "COMBO") (r.config as unknown as ComboConfig).items.forEach((i) => productIds.add(i.productId));
  }
  const [products, cats] = await Promise.all([
    productIds.size ? db.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, name: true, price: true } }) : [],
    categoryIds.size ? db.category.findMany({ where: { id: { in: [...categoryIds] } }, select: { id: true, name: true } }) : [],
  ]);
  return { products: new Map(products.map((p) => [p.id, p])), cats: new Map(cats.map((c) => [c.id, c.name])) };
}

function toRule(r: Row, lab: Awaited<ReturnType<typeof labelsFor>>): PromoRule {
  const rule: PromoRule = { id: r.id, name: r.name, kind: r.kind, sort: r.sort, config: r.config as unknown as PromoRule["config"], allowCode: r.allowCode, withHappyHour: r.withHappyHour };
  if (r.kind === "BUY_GET") {
    const c = rule.config as BuyGetConfig;
    const names = c.productIds.map((id) => lab.products.get(id)?.name).filter(Boolean) as string[];
    rule.labels = { target: names.length ? names.join(", ") : c.categoryId ? lab.cats.get(c.categoryId)?.toLowerCase() : undefined };
  }
  if (r.kind === "COMBO") rule.labels = { items: Object.fromEntries((rule.config as ComboConfig).items.map((i) => [i.productId, lab.products.get(i.productId)?.name ?? "позиция"])) };
  return rule;
}

/** Акции, которые подходят прямо сейчас (включены, канал, расписание, общий лимит). */
async function loadApplicable(db: Db, channel: Channel, at: number) {
  const rows = await db.promotion.findMany({ where: { isActive: true, ...(channel === "SITE" ? { onSite: true } : { onPos: true }) } });
  const ok = rows.filter((r) => inSchedule(r, at) && (r.totalLimit == null || r.usedCount < r.totalLimit));
  return ok;
}

export type CartPromos = EvalResult & { customerId: string | null };

/**
 * Считает акции для корзины. Клиента определяем по customerId (касса) или по телефону (сайт).
 * Без клиента акция «на первый заказ» не применяется, а гостю показывается подсказка.
 */
export async function promotionsForCart(db: Db, lines: CartLine[], ctx: { channel: Channel; customerId?: string | null; phone?: string | null; at?: number }): Promise<CartPromos> {
  const at = ctx.at ?? Date.now();
  let rows = await loadApplicable(db, ctx.channel, at);
  if (rows.length === 0) return { discount: 0, applied: [], hints: [], customerId: ctx.customerId ?? null };

  let customerId = ctx.customerId ?? null;
  if (!customerId && ctx.phone) customerId = (await db.customer.findUnique({ where: { phone: ctx.phone }, select: { id: true } }))?.id ?? null;

  if (customerId) {
    const limited = rows.filter((r) => r.perCustomerLimit != null);
    if (limited.length) {
      const used = await db.promotionUse.groupBy({ by: ["promotionId"], where: { customerId, promotionId: { in: limited.map((r) => r.id) } }, _count: { _all: true } });
      const cnt = new Map(used.map((u) => [u.promotionId, u._count._all]));
      rows = rows.filter((r) => r.perCustomerLimit == null || (cnt.get(r.id) ?? 0) < r.perCustomerLimit);
    }
  }

  let firstOrder: boolean | null = null;
  if (rows.some((r) => r.kind === "FIRST_ORDER")) {
    if (customerId) firstOrder = (await db.order.count({ where: { customerId, status: { not: "CANCELLED" } } })) === 0;
    else if (ctx.phone) firstOrder = true;
  }

  const lab = await labelsFor(db, rows);
  const res = evaluate(rows.map((r) => toRule(r, lab)), lines, { firstOrder });
  return { ...res, customerId };
}

/** Правило запрещает промокод вместе с собой: возвращает название акции или null. */
export const codeBlockedBy = (applied: Applied[]) => applied.find((a) => !a.allowCode)?.name ?? null;

/** Запись применённых акций при создании заказа. Общий лимит держим атомарно. */
export async function recordUses(tx: Prisma.TransactionClient, orderId: string, customerId: string | null, applied: Applied[]) {
  for (const a of applied) {
    const p = await tx.promotion.findUnique({ where: { id: a.id }, select: { totalLimit: true } });
    const u = await tx.promotion.updateMany({
      where: { id: a.id, ...(p?.totalLimit != null ? { usedCount: { lt: p.totalLimit } } : {}) },
      data: { usedCount: { increment: 1 }, discountTotal: { increment: a.amount } },
    });
    if (u.count === 0) throw new ApiError(400, `Акция «${a.name}» только что закончилась. Обновите корзину.`);
    await tx.promotionUse.create({ data: { promotionId: a.id, orderId, customerId, amount: a.amount } });
  }
}

// ───────────── Витрина ─────────────
export type PublicPromo = { id: string; name: string; description: string | null; kind: PromoKind; kindLabel: string; condition: string; when: string; activeNow: boolean };

export async function publicPromotions(at = Date.now()): Promise<PublicPromo[]> {
  const rows = await prisma.promotion.findMany({ where: { isActive: true, onSite: true }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }] });
  const live = rows.filter((r) => (!r.endsAt || r.endsAt.getTime() >= at) && (r.totalLimit == null || r.usedCount < r.totalLimit));
  const lab = await labelsFor(prisma, live);
  return live.map((r) => {
    const rule = toRule(r, lab);
    const comboSum = r.kind === "COMBO" ? (r.config as unknown as ComboConfig).items.reduce((a, i) => a + Number(lab.products.get(i.productId)?.price ?? 0) * i.qty, 0) : undefined;
    return { id: r.id, name: r.name, description: r.description, kind: r.kind, kindLabel: KIND_LABEL[r.kind], condition: describeRule(rule, { comboSum }), when: scheduleText(r), activeNow: inSchedule(r, at) };
  });
}

// ───────────── Админка ─────────────
export async function listPromotions() {
  const rows = await prisma.promotion.findMany({ orderBy: [{ isActive: "desc" }, { sort: "asc" }, { createdAt: "desc" }] });
  const lab = await labelsFor(prisma, rows);
  const now = Date.now();
  return rows.map((r) => {
    const rule = toRule(r, lab);
    const comboSum = r.kind === "COMBO" ? (r.config as unknown as ComboConfig).items.reduce((a, i) => a + Number(lab.products.get(i.productId)?.price ?? 0) * i.qty, 0) : undefined;
    return {
      id: r.id, name: r.name, kind: r.kind, kindLabel: KIND_LABEL[r.kind], isActive: r.isActive, condition: describeRule(rule, { comboSum }), when: scheduleText(r),
      onSite: r.onSite, onPos: r.onPos, allowCode: r.allowCode, usedCount: r.usedCount, totalLimit: r.totalLimit, perCustomerLimit: r.perCustomerLimit,
      discountTotal: Number(r.discountTotal), expired: !!r.endsAt && r.endsAt.getTime() < now, exhausted: r.totalLimit != null && r.usedCount >= r.totalLimit,
    };
  });
}

const intIn = (label: string, min: number, max: number) => z.coerce.number({ error: `${label}: укажите число` }).int(`${label}: целое число`).min(min, `${label}: не меньше ${min}`).max(max, `${label}: не больше ${max}`);
const time = (label: string, def: string) => z.preprocess(blank, z.string().default(def)).transform((v, ctx) => { const m = parseHhmm(v as string); if (m == null) ctx.addIssue({ code: "custom", message: `${label}: время в формате 16:00` }); return m ?? 0; });
const dateStr = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата").optional());

const common = {
  name: z.string().trim().min(2, "Введите название").max(60, "Название слишком длинное"),
  description: z.preprocess(blank, z.string().trim().max(200, "Описание слишком длинное").optional()),
  onSite: z.boolean().default(true), onPos: z.boolean().default(true), allowCode: z.boolean().default(false), withHappyHour: z.boolean().default(false),
  days: z.array(z.coerce.number().int().min(1).max(7)).default([]),
  start: time("Начало", "00:00"), end: time("Конец", "24:00"),
  startsAt: dateStr, endsAt: dateStr,
  totalLimit: z.preprocess(blank, intIn("Общий лимит", 1, 10_000_000).optional()),
  perCustomerLimit: z.preprocess(blank, intIn("Лимит на клиента", 1, 10_000).optional()),
  sort: z.preprocess(blank, intIn("Порядок", 0, 1000).default(0)),
};
const kindSchemas = {
  BUY_GET: z.object({ ...common, kind: z.literal("BUY_GET"), target: z.string().regex(/^[cp]:.+/, "Выберите категорию или продукт"), buy: intIn("Сколько купить", 1, 10), free: intIn("Сколько в подарок", 1, 10), percent: intIn("Скидка на подарочные", 1, 100) }),
  COMBO: z.object({ ...common, kind: z.literal("COMBO"), items: z.array(z.object({ productId: z.string().min(1), qty: intIn("Количество", 1, 5) })).min(1, "Добавьте позиции набора").max(4), price: z.coerce.number({ error: "Укажите цену набора" }).positive("Цена набора должна быть больше 0").max(100_000_000) }),
  THRESHOLD: z.object({ ...common, kind: z.literal("THRESHOLD"), tiers: z.array(z.object({ from: z.coerce.number().positive("Сумма ступени должна быть больше 0").max(1_000_000_000), percent: z.preprocess(blank, z.coerce.number().int().min(1, "Скидка от 1%").max(90, "Скидка не больше 90%").optional()), off: z.preprocess(blank, z.coerce.number().positive().max(1_000_000_000).optional()) })).min(1, "Добавьте хотя бы одну ступень").max(4) }),
  FIRST_ORDER: z.object({ ...common, kind: z.literal("FIRST_ORDER"), percent: intIn("Скидка", 1, 90), maxOff: z.preprocess(blank, z.coerce.number().positive("Максимум скидки должен быть больше 0").max(1_000_000_000).optional()) }),
};
export const promotionSchema = z.discriminatedUnion("kind", [kindSchemas.BUY_GET, kindSchemas.COMBO, kindSchemas.THRESHOLD, kindSchemas.FIRST_ORDER])
  .refine((d) => d.end > d.start, { message: "Конец должен быть позже начала", path: ["end"] })
  .refine((d) => !d.startsAt || !d.endsAt || d.endsAt >= d.startsAt, { message: "Дата окончания раньше даты начала", path: ["endsAt"] });

export async function createPromotion(input: unknown, user: Actor) {
  const d = promotionSchema.parse(input);
  let config: BuyGetConfig | ComboConfig | ThresholdConfig | FirstOrderConfig;
  if (d.kind === "BUY_GET") {
    const [t, id] = [d.target[0], d.target.slice(2)];
    if (t === "c" ? !(await prisma.category.findUnique({ where: { id } })) : !(await prisma.product.findUnique({ where: { id } }))) throw new ApiError(400, "Категория или продукт не найдены");
    config = { productIds: t === "p" ? [id] : [], categoryId: t === "c" ? id : null, buy: d.buy, free: d.free, percent: d.percent };
  } else if (d.kind === "COMBO") {
    const ids = d.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) throw new ApiError(400, "Позиции набора не должны повторяться");
    if (d.items.length === 1 && d.items[0].qty < 2) throw new ApiError(400, "В наборе должно быть хотя бы две штуки");
    const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, price: true } });
    if (products.length !== ids.length) throw new ApiError(400, "Продукт набора не найден");
    const sum = d.items.reduce((a, i) => a + Number(products.find((p) => p.id === i.productId)!.price) * i.qty, 0);
    if (d.price >= sum) throw new ApiError(400, `Цена набора должна быть ниже суммы позиций (${new Intl.NumberFormat("ru-RU").format(sum)} сум), иначе скидки не будет`);
    config = { items: d.items, price: d.price };
  } else if (d.kind === "THRESHOLD") {
    const tiers = d.tiers.map((t) => {
      if ((t.percent == null) === (t.off == null)) throw new ApiError(400, "В каждой ступени укажите либо процент, либо сумму скидки");
      return t.percent != null ? { from: t.from, percent: t.percent } : { from: t.from, off: t.off! };
    });
    if (new Set(tiers.map((t) => t.from)).size !== tiers.length) throw new ApiError(400, "Суммы ступеней не должны повторяться");
    config = { tiers: tiers.sort((a, b) => a.from - b.from) };
  } else config = { percent: d.percent, maxOff: d.maxOff ?? null };

  const p = await prisma.promotion.create({ data: {
    name: d.name, description: d.description ?? null, kind: d.kind, config: config as unknown as Prisma.InputJsonValue,
    onSite: d.onSite, onPos: d.onPos, allowCode: d.allowCode, withHappyHour: d.withHappyHour,
    days: [...new Set(d.days)].sort(), startMin: d.start, endMin: d.end,
    startsAt: d.startsAt ? new Date(`${d.startsAt}T00:00:00+05:00`) : null, endsAt: d.endsAt ? new Date(`${d.endsAt}T23:59:59+05:00`) : null,
    totalLimit: d.totalLimit ?? null, perCustomerLimit: d.perCustomerLimit ?? null, sort: d.sort,
  } });
  await audit({ userId: user.id, action: "PROMOTION_CREATED", entity: "Promotion", entityId: p.id, newValue: { name: d.name, kind: d.kind, config: config as unknown as Prisma.InputJsonValue } });
}

export async function setPromotionActive(id: string, isActive: boolean, user: Actor) {
  const p = await prisma.promotion.findUnique({ where: { id } });
  if (!p) throw new ApiError(404, "Акция не найдена");
  await prisma.promotion.update({ where: { id }, data: { isActive } });
  await audit({ userId: user.id, action: "PROMOTION_TOGGLED", entity: "Promotion", entityId: id, oldValue: { isActive: p.isActive }, newValue: { name: p.name, isActive } });
}

export async function deletePromotion(id: string, user: Actor) {
  const p = await prisma.promotion.findUnique({ where: { id } });
  if (!p) throw new ApiError(404, "Акция не найдена");
  if (p.usedCount > 0) throw new ApiError(400, "Акция уже применялась в заказах — отключите её, удалять нельзя");
  await prisma.promotion.delete({ where: { id } });
  await audit({ userId: user.id, action: "PROMOTION_DELETED", entity: "Promotion", entityId: id, oldValue: { name: p.name } });
}
