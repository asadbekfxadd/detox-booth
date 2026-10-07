import { describe, it, expect } from "vitest";
import { computeDiscount } from "@/services/pos";

type Promo = { id: string; code: string; type: "PERCENT" | "FIXED"; value: number; minOrder: number; isActive: boolean; usageLimit: number | null; usedCount: number; expiresAt: Date | null };
const promo = (o: Partial<Promo> = {}): Promo => ({ id: "p1", code: "TEST", type: "PERCENT", value: 10, minOrder: 0, isActive: true, usageLimit: null, usedCount: 0, expiresAt: null, ...o });
// Минимальная подмена базы: computeDiscount читает только промокод и настройку.
const db = (p: Promo | null, cap?: number) => ({
  promoCode: { findFirst: async () => p },
  setting: { findUnique: async () => (cap == null ? null : { value: cap }) },
}) as never;
const cashier = { id: "u", role: "CASHIER" as const, locationId: "l" };
const manager = { id: "u", role: "MANAGER" as const, locationId: "l" };

describe("скидки на кассе", () => {
  it("процентный промокод", async () => expect((await computeDiscount(db(promo()), 100000, { promoCode: "test" }, cashier)).discount).toBe(10000));
  it("фиксированная скидка не больше суммы заказа", async () =>
    expect((await computeDiscount(db(promo({ type: "FIXED", value: 500000 })), 40000, { promoCode: "x" }, cashier)).discount).toBe(40000));
  it("минимальная сумма заказа", async () =>
    await expect(computeDiscount(db(promo({ minOrder: 50000 })), 41000, { promoCode: "x" }, cashier)).rejects.toThrow("Минимальная сумма"));
  it("отключённый и неизвестный промокод", async () => {
    await expect(computeDiscount(db(promo({ isActive: false })), 1000, { promoCode: "x" }, cashier)).rejects.toThrow("не найден");
    await expect(computeDiscount(db(null), 1000, { promoCode: "x" }, cashier)).rejects.toThrow("не найден");
  });
  it("истёкший промокод и исчерпанный лимит", async () => {
    await expect(computeDiscount(db(promo({ expiresAt: new Date(Date.now() - 1000) })), 1000, { promoCode: "x" }, cashier)).rejects.toThrow("истёк");
    await expect(computeDiscount(db(promo({ usageLimit: 3, usedCount: 3 })), 1000, { promoCode: "x" }, cashier)).rejects.toThrow("максимальное");
  });
  it("промокод и ручная скидка вместе нельзя", async () =>
    await expect(computeDiscount(db(promo()), 1000, { promoCode: "x", manualDiscount: { type: "PERCENT", value: 5 } }, cashier)).rejects.toThrow("одновременно"));
  it("кассир ограничен 10% по умолчанию", async () => {
    await expect(computeDiscount(db(null), 40000, { manualDiscount: { type: "PERCENT", value: 90 } }, cashier)).rejects.toThrow("не более 10%");
    expect((await computeDiscount(db(null), 40000, { manualDiscount: { type: "PERCENT", value: 10 } }, cashier)).discount).toBe(4000);
  });
  it("лимит кассира берётся из настроек", async () =>
    expect((await computeDiscount(db(null, 20), 40000, { manualDiscount: { type: "PERCENT", value: 20 } }, cashier)).discount).toBe(8000));
  it("менеджер может дать больше, но не больше 100% и не больше суммы", async () => {
    expect((await computeDiscount(db(null), 40000, { manualDiscount: { type: "PERCENT", value: 50 } }, manager)).discount).toBe(20000);
    await expect(computeDiscount(db(null), 40000, { manualDiscount: { type: "PERCENT", value: 101 } }, manager)).rejects.toThrow("100%");
    await expect(computeDiscount(db(null), 40000, { manualDiscount: { type: "FIXED", value: 50000 } }, manager)).rejects.toThrow("больше суммы");
  });
  it("без скидки — ноль", async () => expect((await computeDiscount(db(null), 1000, {}, cashier)).discount).toBe(0));
});
