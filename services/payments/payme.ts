import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/**
 * Payme Business, Merchant API (JSON-RPC 2.0): Payme сам вызывает наш адрес /api/payments/payme.
 * Суммы у Payme в тийинах (1 сум = 100 тийин). Заказ определяется полем account.order_id (id заказа).
 * Состояния транзакции: 1 — создана, 2 — оплачена, -1 — отменена до оплаты, -2 — возврат после оплаты.
 */
export const PAYME_TIMEOUT_MS = 43_200_000; // 12 часов на оплату после создания транзакции

export type PaymeConfig = { merchantId: string; key: string; test: boolean };

export function paymeConfig(env: NodeJS.ProcessEnv = process.env): PaymeConfig | null {
  const merchantId = env.PAYME_MERCHANT_ID?.trim(), key = env.PAYME_KEY?.trim();
  if (!merchantId || !key) return null;
  return { merchantId, key, test: env.PAYME_TEST === "1" };
}

export const toTiyin = (uzs: number) => Math.round(uzs * 100);

/** Ссылка на оплату: параметры кодируются в base64 по правилам Payme. */
export function paymeCheckoutUrl(cfg: PaymeConfig, p: { orderId: string; amountUzs: number; returnUrl: string }): string {
  const params = `m=${cfg.merchantId};ac.order_id=${p.orderId};a=${toTiyin(p.amountUzs)};l=ru;c=${p.returnUrl}`;
  return `${cfg.test ? "https://test.paycom.uz" : "https://checkout.paycom.uz"}/${Buffer.from(params).toString("base64")}`;
}

/** Заголовок Authorization: Basic base64("Paycom:" + KEY). */
export function paymeAuthOk(header: string | null, key: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  const got = Buffer.from(header.slice(6).trim(), "base64");
  const want = Buffer.from(`Paycom:${key}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

const msg = (ru: string, uz: string, en: string) => ({ ru, uz, en });
export class PaymeError extends Error {
  constructor(readonly code: number, readonly text: { ru: string; uz: string; en: string }, readonly data?: string) { super(text.en); }
}
const E = {
  auth: () => new PaymeError(-32504, msg("Недостаточно привилегий", "Ruxsat yo'q", "Insufficient privileges")),
  request: () => new PaymeError(-32600, msg("Неверный запрос", "Noto'g'ri so'rov", "Invalid request")),
  method: () => new PaymeError(-32601, msg("Метод не найден", "Metod topilmadi", "Method not found")),
  system: () => new PaymeError(-32400, msg("Системная ошибка", "Tizim xatosi", "System error")),
  amount: () => new PaymeError(-31001, msg("Неверная сумма", "Noto'g'ri summa", "Wrong amount")),
  noTx: () => new PaymeError(-31003, msg("Транзакция не найдена", "Tranzaksiya topilmadi", "Transaction not found")),
  cantCancel: () => new PaymeError(-31007, msg("Заказ выполнен, отмена невозможна", "Buyurtma bajarilgan, bekor qilib bo'lmaydi", "Order completed, cannot cancel")),
  cantPerform: () => new PaymeError(-31008, msg("Операция невозможна", "Amalni bajarib bo'lmaydi", "Cannot perform operation")),
  noOrder: () => new PaymeError(-31050, msg("Заказ не найден", "Buyurtma topilmadi", "Order not found"), "order_id"),
  notPayable: () => new PaymeError(-31051, msg("Заказ не ожидает оплаты", "Buyurtma to'lovni kutmayapti", "Order is not awaiting payment"), "order_id"),
  busy: () => new PaymeError(-31099, msg("По заказу уже идёт другая оплата", "Buyurtma bo'yicha boshqa to'lov davom etmoqda", "Another payment is in progress"), "order_id"),
};

type Tx = Awaited<ReturnType<typeof prisma.paymeTransaction.findUniqueOrThrow>>;
const n = (v: bigint | number | null | undefined) => (v == null ? 0 : Number(v));
const state = (t: Tx) => ({ create_time: n(t.createTime), perform_time: n(t.performTime), cancel_time: n(t.cancelTime), transaction: t.id, state: t.state, reason: t.reason });

async function payableOrder(orderId: unknown, tiyin: unknown) {
  if (typeof orderId !== "string" || !orderId) throw E.noOrder();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  const pay = order?.payments.find((p) => p.provider === "payme");
  if (!order || !pay) throw E.noOrder();
  if (typeof tiyin !== "number" || !Number.isFinite(tiyin) || tiyin !== toTiyin(Number(pay.amount))) throw E.amount();
  if (order.status === "CANCELLED" || pay.status !== "PENDING") throw E.notPayable();
  return { order, pay };
}

/** Просроченную (12 ч) созданную транзакцию отменяем сами: reason 4. */
async function expireIfNeeded(t: Tx, now: number): Promise<Tx> {
  if (t.state !== 1 || now - n(t.createTime) <= PAYME_TIMEOUT_MS) return t;
  return prisma.paymeTransaction.update({ where: { id: t.id }, data: { state: -1, reason: 4, cancelTime: BigInt(now) } });
}

type Params = Record<string, unknown>;
const lockOrder = (tx: Prisma.TransactionClient, key: string) => tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"payme:" + key}))`);

const methods: Record<string, (p: Params, now: number) => Promise<unknown>> = {
  async CheckPerformTransaction(p) {
    await payableOrder((p.account as Params | undefined)?.order_id, p.amount);
    return { allow: true };
  },

  async CreateTransaction(p, now) {
    const id = typeof p.id === "string" ? p.id : "";
    if (!id || typeof p.time !== "number") throw E.request();
    const orderId = (p.account as Params | undefined)?.order_id;
    return prisma.$transaction(async (db) => {
      await lockOrder(db, typeof orderId === "string" ? orderId : id);
      const existing = await db.paymeTransaction.findUnique({ where: { id } });
      if (existing) {
        const t = await expireIfNeeded(existing, now);
        if (t.state !== 1) throw E.cantPerform();
        return { create_time: n(t.createTime), transaction: t.id, state: t.state };
      }
      const { order, pay } = await payableOrder(orderId, p.amount);
      const other = await db.paymeTransaction.findFirst({ where: { orderId: order.id, state: { in: [1, 2] } } });
      if (other) {
        const o = await expireIfNeeded(other, now);
        if (o.state === 1 || o.state === 2) throw E.busy();
      }
      const t = await db.paymeTransaction.create({ data: { id, orderId: order.id, paymentId: pay.id, amount: BigInt(p.amount as number), state: 1, time: BigInt(p.time as number), createTime: BigInt(now) } });
      return { create_time: n(t.createTime), transaction: t.id, state: 1 };
    }, { timeout: 15000 });
  },

  async PerformTransaction(p, now) {
    const id = typeof p.id === "string" ? p.id : "";
    const found = id ? await prisma.paymeTransaction.findUnique({ where: { id } }) : null;
    if (!found) throw E.noTx();
    const out = await prisma.$transaction(async (db) => {
      await lockOrder(db, found.orderId);
      const cur = await db.paymeTransaction.findUniqueOrThrow({ where: { id } });
      if (cur.state === 2) return { transaction: cur.id, perform_time: n(cur.performTime), state: 2, confirmed: false };
      if (cur.state !== 1) throw E.cantPerform();
      if (now - n(cur.createTime) > PAYME_TIMEOUT_MS) {
        await db.paymeTransaction.update({ where: { id }, data: { state: -1, reason: 4, cancelTime: BigInt(now) } });
        return null; // сообщим ошибкой после коммита отмены
      }
      const order = await db.order.findUnique({ where: { id: cur.orderId }, select: { status: true } });
      if (!order || order.status === "CANCELLED") throw E.cantPerform();
      await db.paymeTransaction.update({ where: { id }, data: { state: 2, performTime: BigInt(now) } });
      await db.payment.updateMany({ where: { orderId: cur.orderId, provider: "payme", status: "PENDING" }, data: { status: "PAID", externalId: cur.id } });
      return { transaction: cur.id, perform_time: now, state: 2, confirmed: true, orderId: cur.orderId };
    }, { timeout: 15000 });
    if (!out) throw E.cantPerform();
    if (out.confirmed) await audit({ action: "PAYMENT_CONFIRMED", entity: "Order", entityId: out.orderId, newValue: { provider: "payme", externalId: id } });
    return { transaction: out.transaction, perform_time: out.perform_time, state: out.state };
  },

  async CancelTransaction(p, now) {
    const id = typeof p.id === "string" ? p.id : "";
    const found = id ? await prisma.paymeTransaction.findUnique({ where: { id } }) : null;
    if (!found) throw E.noTx();
    const reason = typeof p.reason === "number" ? p.reason : null;
    const r = await prisma.$transaction(async (db) => {
      await lockOrder(db, found.orderId);
      const cur = await db.paymeTransaction.findUniqueOrThrow({ where: { id } });
      if (cur.state === -1 || cur.state === -2) return { t: cur, refunded: false };
      if (cur.state === 1) {
        const t = await db.paymeTransaction.update({ where: { id }, data: { state: -1, reason, cancelTime: BigInt(now) } });
        return { t, refunded: false };
      }
      // state 2: возврат денег. Можно, пока заказ ещё не в работе.
      const order = await db.order.findUnique({ where: { id: cur.orderId }, select: { status: true } });
      if (order && order.status !== "NEW" && order.status !== "CANCELLED") throw E.cantCancel();
      const t = await db.paymeTransaction.update({ where: { id }, data: { state: -2, reason, cancelTime: BigInt(now) } });
      await db.payment.updateMany({ where: { orderId: cur.orderId, provider: "payme", status: "PAID" }, data: { status: "REFUNDED" } });
      await db.order.updateMany({ where: { id: cur.orderId, status: "NEW" }, data: { status: "CANCELLED" } });
      return { t, refunded: true };
    }, { timeout: 15000 });
    if (r.refunded) await audit({ action: "PAYMENT_REFUNDED", entity: "Order", entityId: r.t.orderId, newValue: { provider: "payme", externalId: id, reason } });
    return { transaction: r.t.id, cancel_time: n(r.t.cancelTime), state: r.t.state };
  },

  async CheckTransaction(p) {
    const id = typeof p.id === "string" ? p.id : "";
    const t = id ? await prisma.paymeTransaction.findUnique({ where: { id } }) : null;
    if (!t) throw E.noTx();
    return state(t);
  },

  async GetStatement(p) {
    if (typeof p.from !== "number" || typeof p.to !== "number") throw E.request();
    const rows = await prisma.paymeTransaction.findMany({ where: { createTime: { gte: BigInt(p.from), lte: BigInt(p.to) } }, orderBy: { createTime: "asc" } });
    return { transactions: rows.map((t) => ({ id: t.id, time: n(t.time), amount: n(t.amount), account: { order_id: t.orderId }, ...state(t) })) };
  },
};

/** Разбирает один JSON-RPC запрос Payme. Возвращает тело ответа (HTTP 200 всегда, как требует Payme). */
export async function handlePayme(raw: unknown, authHeader: string | null, cfg: PaymeConfig, now = Date.now()) {
  const body = (raw && typeof raw === "object" ? raw : {}) as { id?: unknown; method?: unknown; params?: unknown };
  const id = body.id ?? null;
  const fail = (e: PaymeError) => ({ error: { code: e.code, message: e.text, ...(e.data ? { data: e.data } : {}) }, id });
  if (!paymeAuthOk(authHeader, cfg.key)) return fail(E.auth());
  if (typeof body.method !== "string" || !body.params || typeof body.params !== "object") return fail(E.request());
  const fn = methods[body.method];
  if (!fn) return fail(E.method());
  try {
    return { result: await fn(body.params as Params, now), id };
  } catch (e) {
    if (e instanceof PaymeError) return fail(e);
    console.error("[PAYME]", body.method, e);
    return fail(E.system());
  }
}
