import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

type Actor = { id: string; role: Role; locationId: string | null };

export type SettingField = { key: string; label: string; hint: string; min: number; max: number; int: boolean; def: number; step: string; group: string };
export const SETTING_FIELDS: SettingField[] = [
  { group: "Лояльность", key: "loyalty.earnRate", label: "Баллов за 1 UZS оплаты", hint: "Например 0.05 — это 5 баллов с каждых 100 UZS", min: 0, max: 10, int: false, def: 1, step: "0.001" },
  { group: "Лояльность", key: "loyalty.pointValue", label: "Стоимость 1 балла при списании, UZS", hint: "Обычно 1: 1 балл = 1 UZS скидки", min: 0.01, max: 100000, int: false, def: 1, step: "0.01" },
  { group: "Лояльность", key: "loyalty.maxRedeemPct", label: "Максимум заказа, оплачиваемый баллами, %", hint: "От суммы после скидки по промокоду", min: 0, max: 100, int: false, def: 30, step: "1" },
  { group: "Лояльность", key: "loyalty.welcomeBonus", label: "Приветственный бонус, баллов", hint: "Новому клиенту при первом оформлении. 0 — выключено", min: 0, max: 1000000, int: true, def: 0, step: "1" },
  { group: "Лояльность", key: "loyalty.referralBonus", label: "Реферальный бонус, баллов", hint: "Получают оба: пригласивший и приглашённый — за первый завершённый заказ. 0 — выключено", min: 0, max: 1000000, int: true, def: 0, step: "1" },
  { group: "Заказы", key: "delivery.fee", label: "Стоимость доставки, UZS", hint: "Добавляется к заказам с доставкой на сайте", min: 0, max: 10000000, int: false, def: 0, step: "1" },
  { group: "Заказы", key: "orders.minLeadMinutes", label: "Минимум до выдачи «к времени», мин", hint: "Раньше этого срока клиент не сможет выбрать время получения на сайте", min: 5, max: 240, int: true, def: 15, step: "5" },
  { group: "Заказы", key: "orders.delayMinutes", label: "Заказ считается задержанным через, мин", hint: "Подсветка в списке заказов и на доске", min: 1, max: 600, int: true, def: 30, step: "1" },
  { group: "Касса и склад", key: "pos.cashierMaxDiscountPct", label: "Максимальная ручная скидка кассира, %", hint: "Больше этого кассир скидку дать не сможет", min: 0, max: 100, int: false, def: 10, step: "1" },
  { group: "Касса и склад", key: "writeoff.largeThreshold", label: "Порог «крупного» списания, UZS", hint: "Выше этой суммы списание создаёт уведомление", min: 0, max: 10000000000, int: false, def: 200000, step: "1000" },
];

export async function getSettingValues() {
  const rows = await prisma.setting.findMany({ where: { key: { in: SETTING_FIELDS.map((f) => f.key) } } });
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SETTING_FIELDS.map((f) => {
    const v = m.get(f.key);
    return [f.key, typeof v === "number" ? v : f.def];
  })) as Record<string, number>;
}

export async function saveSettings(input: Record<string, string>, user: Actor) {
  const current = await getSettingValues();
  const changes: Record<string, { from: number; to: number }> = {};
  for (const f of SETTING_FIELDS) {
    const raw = (input[f.key] ?? "").replace(",", ".").trim();
    if (raw === "") throw new ApiError(400, `Заполните: «${f.label}»`);
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new ApiError(400, `«${f.label}»: введите число`);
    if (f.int && !Number.isInteger(n)) throw new ApiError(400, `«${f.label}»: нужно целое число`);
    if (n < f.min || n > f.max) throw new ApiError(400, `«${f.label}»: допустимо от ${f.min} до ${f.max}`);
    if (n !== current[f.key]) changes[f.key] = { from: current[f.key], to: n };
  }
  const keys = Object.keys(changes);
  if (keys.length === 0) return 0;
  await prisma.$transaction(keys.map((k) => prisma.setting.upsert({ where: { key: k }, create: { key: k, value: changes[k].to }, update: { value: changes[k].to } })));
  try { await audit({ userId: user.id, action: "SETTINGS_CHANGED", entity: "Setting", newValue: changes }); } catch (e) { console.error("[AUDIT ERROR]", e); }
  return keys.length;
}
