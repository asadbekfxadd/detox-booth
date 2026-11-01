import { describe, it, expect } from "vitest";
import { autoPrintOn, receiptPath, POS_AUTOPRINT_KEY } from "@/lib/auto-print";

describe("автопечать чека на кассе", () => {
  it("по умолчанию включена, выключается только явным «0»", () => {
    expect(autoPrintOn(null)).toBe(true);
    expect(autoPrintOn(undefined)).toBe(true);
    expect(autoPrintOn("1")).toBe(true);
    expect(autoPrintOn("")).toBe(true);
    expect(autoPrintOn("0")).toBe(false);
    expect(POS_AUTOPRINT_KEY).toBe("pos.autoprint");
  });

  it("адрес чека: в рамке с ?auto=1, для приложения без параметра", () => {
    expect(receiptPath("abc123", true)).toBe("/print/order/abc123?auto=1");
    expect(receiptPath("abc123", false)).toBe("/print/order/abc123");
  });

  it("id заказа экранируется в адресе", () => {
    expect(receiptPath("a/b?c", true)).toBe("/print/order/a%2Fb%3Fc?auto=1");
  });
});
