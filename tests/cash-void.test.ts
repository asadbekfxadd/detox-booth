import { describe, it, expect } from "vitest";
import { expectedCash, canWithdraw } from "@/lib/cash";
import { applyVoid, needsManagerApproval, sentToKitchen } from "@/lib/void-item";

const base = { opening: 100000, cashSales: 500000, cashTips: 10000, cashRefunds: 20000, cashIn: 0, cashOut: 0 };

describe("наличные в кассе", () => {
  it("без движений считается как раньше", () => {
    expect(expectedCash(base)).toBe(590000);
  });
  it("внесение увеличивает, изъятие уменьшает", () => {
    expect(expectedCash({ ...base, cashIn: 50000, cashOut: 30000 })).toBe(610000);
  });
  it("копейки не плывут", () => {
    expect(expectedCash({ ...base, cashSales: 0.1, cashTips: 0.2, opening: 0, cashRefunds: 0 })).toBe(0.3);
  });
  it("нельзя изъять больше, чем в кассе, и ноль или минус", () => {
    expect(canWithdraw(1000, 1000)).toBe(true);
    expect(canWithdraw(1000, 1000.01)).toBe(false);
    expect(canWithdraw(1000, 0)).toBe(false);
    expect(canWithdraw(1000, -5)).toBe(false);
  });
});

describe("отмена позиции", () => {
  const order = { subtotal: 100000, total: 100000, items: [{ id: "a", quantity: 2, unitPrice: 30000 }, { id: "b", quantity: 1, unitPrice: 40000 }] };
  it("часть порций: сумма уменьшается, позиция остаётся", () => {
    const r = applyVoid(order, "a", 1);
    expect(r).toMatchObject({ ok: true, removedSum: 30000, leftQty: 1, orderEmpty: false, newTotal: 70000, newSubtotal: 70000 });
  });
  it("вся позиция при других позициях: заказ жив", () => {
    const r = applyVoid(order, "a", 2);
    expect(r).toMatchObject({ ok: true, leftQty: 0, orderEmpty: false, newTotal: 40000 });
  });
  it("последняя позиция: заказ становится пустым", () => {
    const r = applyVoid({ subtotal: 40000, total: 40000, items: [{ id: "b", quantity: 1, unitPrice: 40000 }] }, "b", 1);
    expect(r).toMatchObject({ ok: true, orderEmpty: true, newTotal: 0 });
  });
  it("ошибки: чужая позиция, лишнее количество, дробь", () => {
    expect(applyVoid(order, "zzz", 1).ok).toBe(false);
    expect(applyVoid(order, "a", 3).ok).toBe(false);
    expect(applyVoid(order, "a", 0).ok).toBe(false);
    expect(applyVoid(order, "a", 1.5).ok).toBe(false);
  });
  it("итог не уходит в минус", () => {
    const r = applyVoid({ subtotal: 10, total: 5, items: [{ id: "a", quantity: 1, unitPrice: 10 }] }, "a", 1);
    expect(r).toMatchObject({ ok: true, newTotal: 0 });
  });
  it("согласование нужно только после отправки на кухню и только без права отмены", () => {
    expect(sentToKitchen({ status: "NEW", onHold: true })).toBe(false);
    expect(sentToKitchen({ status: "NEW", onHold: false })).toBe(true);
    expect(sentToKitchen({ status: "PREPARING", onHold: false })).toBe(true);
    expect(needsManagerApproval({ status: "NEW", onHold: true }, false)).toBe(false);
    expect(needsManagerApproval({ status: "PREPARING", onHold: false }, false)).toBe(true);
    expect(needsManagerApproval({ status: "PREPARING", onHold: false }, true)).toBe(false);
  });
});
