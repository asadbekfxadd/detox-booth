import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { applyYield } from "@/services/availability";

const D = (n: number) => new Prisma.Decimal(n);
const db = (rows: { id: string; yieldPct: number }[]) => ({
  ingredient: { findMany: async () => rows.map((r) => ({ id: r.id, yieldPct: D(r.yieldPct) })) },
}) as never;

describe("applyYield: нетто → брутто для списания", () => {
  it("апельсин с выходом 45%: на 225 мл сока уходит 500 г", async () => {
    const out = await applyYield(db([{ id: "orange", yieldPct: 45 }]), new Map([["orange", D(225)]]));
    expect(out.get("orange")?.toNumber()).toBe(500);
  });
  it("без потерь (100) и ингредиенты вне списка не меняются", async () => {
    const out = await applyYield(db([{ id: "ice", yieldPct: 100 }]), new Map([["ice", D(80)], ["cup", D(1)]]));
    expect(out.get("ice")?.toNumber()).toBe(80);
    expect(out.get("cup")?.toNumber()).toBe(1);
  });
  it("округляет до 3 знаков, как хранится в базе", async () => {
    const out = await applyYield(db([{ id: "x", yieldPct: 30 }]), new Map([["x", D(10)]]));
    expect(out.get("x")?.toString()).toBe("33.333");
  });
  it("пустая корзина не ходит в базу", async () => {
    const out = await applyYield({} as never, new Map());
    expect(out.size).toBe(0);
  });
});
