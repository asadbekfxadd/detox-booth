import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { audit } from "@/lib/audit";

type Actor = { id: string; role: Role; locationId: string | null };

/** toggle — переключатель «Включено/Выключено» вместо числа 1/0 */
export type SettingField = { key: string; label: string; hint: string; min: number; max: number; int: boolean; def: number; step: string; group: string; toggle?: boolean };
export const SETTING_FIELDS: SettingField[] = [
  { group: "Баллы клиентов", key: "loyalty.earnRate", label: "Баллов за 1 UZS оплаты", hint: "Например 0.05 — это 5 баллов с каждых 100 UZS", min: 0, max: 10, int: false, def: 1, step: "0.001" },
  { group: "Баллы клиентов", key: "loyalty.pointValue", label: "Стоимость 1 балла при списании, UZS", hint: "Обычно 1: 1 балл = 1 UZS скидки", min: 0.01, max: 100000, int: false, def: 1, step: "0.01" },
  { group: "Баллы клиентов", key: "loyalty.maxRedeemPct", label: "Максимум заказа, оплачиваемый баллами, %", hint: "От суммы после скидки по промокоду", min: 0, max: 100, int: false, def: 30, step: "1" },
  { group: "Баллы клиентов", key: "loyalty.welcomeBonus", label: "Приветственный бонус, баллов", hint: "Новому клиенту при первом оформлении. 0 — выключено", min: 0, max: 1000000, int: true, def: 0, step: "1" },
  { group: "Баллы клиентов", key: "loyalty.referralBonus", label: "Реферальный бонус, баллов", hint: "Получают оба: пригласивший и приглашённый — за первый завершённый заказ. 0 — выключено", min: 0, max: 1000000, int: true, def: 0, step: "1" },
  { group: "Заказы", key: "delivery.fee", label: "Стоимость доставки, UZS", hint: "Добавляется к заказам с доставкой на сайте", min: 0, max: 10000000, int: false, def: 0, step: "1" },
  { group: "Заказы", key: "orders.minLeadMinutes", label: "Минимум до выдачи «к времени», мин", hint: "Раньше этого срока клиент не сможет выбрать время получения на сайте", min: 5, max: 240, int: true, def: 15, step: "5" },
  { group: "Заказы", key: "orders.delayMinutes", label: "Заказ считается задержанным через, мин", hint: "Подсветка в списке заказов и на доске", min: 1, max: 600, int: true, def: 30, step: "1" },
  { group: "Столы", key: "table.serviceFeePct", label: "Сервисный сбор за столом, %", hint: "Добавляется к сумме заказов при оплате счёта стола. 0 — без сбора. Гость видит его в счёте", min: 0, max: 30, int: false, def: 0, step: "1" },
  { group: "Бронь столов", key: "booking.enabled", label: "Онлайн-бронь на сайте", hint: "Если включена, на сайте появляется страница «Бронь стола». Вручную брони можно вносить в админке и при выключенной", min: 0, max: 1, int: true, def: 0, step: "1", toggle: true },
  { group: "Бронь столов", key: "booking.autoConfirm", label: "Подтверждать бронь автоматически", hint: "Если выключено, бронь с сайта ждёт звонка администратора и подтверждения в разделе «Бронь столов»", min: 0, max: 1, int: true, def: 1, step: "1", toggle: true },
  { group: "Бронь столов", key: "booking.depositPerGuest", label: "Депозит за бронь, UZS с гостя", hint: "Показывается гостю при брони. Деньги принимает персонал и отмечает «Депозит получен». 0 — без депозита", min: 0, max: 10000000, int: true, def: 0, step: "1000" },
  { group: "Бронь столов", key: "booking.durationMin", label: "Сколько стол занят бронью, мин", hint: "В это время стол недоступен для других броней", min: 30, max: 480, int: true, def: 90, step: "15" },
  { group: "Бронь столов", key: "booking.openHour", label: "Первая бронь с, час", hint: "Например 10 — первая бронь в 10:00", min: 0, max: 23, int: true, def: 10, step: "1" },
  { group: "Бронь столов", key: "booking.closeHour", label: "Последняя бронь в, час", hint: "Например 21 — последняя бронь на 21:00", min: 1, max: 24, int: true, def: 21, step: "1" },
  { group: "Бронь столов", key: "booking.maxGuests", label: "Максимум гостей в одной брони с сайта", hint: "Для больших компаний гость звонит в заведение", min: 1, max: 100, int: true, def: 8, step: "1" },
  { group: "Бронь столов", key: "booking.leadMinutes", label: "Бронь не позже чем за, мин до визита", hint: "Раньше этого срока бронь на сайте не принимается", min: 0, max: 1440, int: true, def: 60, step: "15" },
  { group: "Бронь столов", key: "booking.maxDays", label: "Бронь открыта на дней вперёд", hint: "Дальше этого срока записаться нельзя", min: 1, max: 365, int: true, def: 30, step: "1" },
  { group: "Себестоимость", key: "costing.plannedDrinks", label: "Плановое число напитков в месяц", hint: "На него делятся зарплата и накладные. 0 — брать фактически проданное за последние 30 дней. Пока продаж мало, укажите план: иначе на первые напитки ляжет вся аренда", min: 0, max: 1000000, int: true, def: 0, step: "100" },
  { group: "Себестоимость", key: "costing.packagingPerDrink", label: "Упаковка на напиток сверх рецепта, UZS", hint: "Стаканчик, крышка, трубочка, если они не внесены в рецепты как ингредиенты категории «Packaging» или «Упаковка»", min: 0, max: 1000000, int: false, def: 0, step: "50" },
  { group: "Себестоимость", key: "costing.lossPct", label: "Потери на ингредиентах, %", hint: "Проливы, брак, обрезь. Добавляется к стоимости ингредиентов", min: 0, max: 100, int: false, def: 0, step: "0.5" },
  { group: "Себестоимость", key: "costing.payrollTaxPct", label: "Налоги и взносы на зарплату, %", hint: "Добавляются к окладам сотрудников. 0 — считать только оклад", min: 0, max: 100, int: false, def: 0, step: "0.5" },
  { group: "Себестоимость", key: "costing.overheadMonthly", label: "Прочие расходы в месяц, UZS (аренда, коммунальные, маркетинг…)", hint: "0 — брать из раздела «Финансы»: все расходы, кроме зарплаты, среднее в месяц за последние 90 дней. Если задать сумму, она заменит расходы из «Финансов»", min: 0, max: 10000000000, int: false, def: 0, step: "1000" },
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
