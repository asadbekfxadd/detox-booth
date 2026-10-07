import type { Prisma } from "@prisma/client";
import { getLoyaltySettings } from "@/lib/loyalty-settings";

type Tx = Prisma.TransactionClient;

/** Новый клиент: счёт баллов и приветственный бонус (если включён в настройках). */
export async function createCustomerTx(db: Tx, d: { name: string; phone: string; referredById?: string | null }) {
  const s = await getLoyaltySettings(db);
  const bonus = Math.floor(s.welcomeBonus);
  return db.customer.create({
    data: {
      name: d.name, phone: d.phone, referredById: d.referredById ?? null,
      loyalty: { create: { points: bonus, ...(bonus > 0 ? { txs: { create: { type: "BONUS", points: bonus, note: "Приветственный бонус" } } } : {}) } },
    },
  });
}

async function credit(tx: Tx, customerId: string, points: number, type: "REFERRAL" | "BONUS", note: string, orderId?: string) {
  const acc = await tx.loyaltyAccount.upsert({ where: { customerId }, create: { customerId, points }, update: { points: { increment: points } } });
  await tx.loyaltyTransaction.create({ data: { accountId: acc.id, type, points, note, orderId } });
}

/** Реферальный бонус: один раз, за первый завершённый заказ приглашённого клиента. Обоим. */
export async function referralBonusTx(tx: Tx, customerId: string, orderId: string) {
  const s = await getLoyaltySettings(tx);
  const bonus = Math.floor(s.referralBonus);
  if (bonus <= 0) return;
  const c = await tx.customer.findUnique({ where: { id: customerId }, include: { loyalty: true } });
  if (!c?.referredById) return;
  if (c.loyalty && (await tx.loyaltyTransaction.findFirst({ where: { accountId: c.loyalty.id, type: "REFERRAL" } }))) return;
  if ((await tx.order.count({ where: { customerId, status: "COMPLETED", id: { not: orderId } } })) > 0) return;
  await credit(tx, c.id, bonus, "REFERRAL", "Бонус за первый заказ по приглашению", orderId);
  await credit(tx, c.referredById, bonus, "REFERRAL", `Бонус: друг ${c.name} сделал первый заказ`, orderId);
}
