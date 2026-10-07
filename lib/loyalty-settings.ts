import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient;

export type LoyaltySettings = {
  earnRate: number;      // баллов за 1 UZS оплаченной суммы
  pointValue: number;    // сколько UZS стоит 1 балл при списании
  maxRedeemPct: number;  // какую долю заказа можно оплатить баллами, %
  welcomeBonus: number;  // баллов новому клиенту
  referralBonus: number; // баллов и пригласившему, и приглашённому за первый завершённый заказ
};
export const LOYALTY_DEFAULTS: LoyaltySettings = { earnRate: 1, pointValue: 1, maxRedeemPct: 30, welcomeBonus: 0, referralBonus: 0 };
const KEYS: Record<keyof LoyaltySettings, string> = {
  earnRate: "loyalty.earnRate", pointValue: "loyalty.pointValue", maxRedeemPct: "loyalty.maxRedeemPct",
  welcomeBonus: "loyalty.welcomeBonus", referralBonus: "loyalty.referralBonus",
};

export async function getLoyaltySettings(db: Db): Promise<LoyaltySettings> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const m = new Map(rows.map((r) => [r.key, r.value as unknown]));
  const out = { ...LOYALTY_DEFAULTS };
  for (const k of Object.keys(KEYS) as (keyof LoyaltySettings)[]) {
    const v = m.get(KEYS[k]);
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}
