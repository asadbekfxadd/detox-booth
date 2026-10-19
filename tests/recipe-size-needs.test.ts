import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { computeNeeds } from "@/services/availability";

const D = (n: number) => new Prisma.Decimal(n);
const option = (id: string, mult = 1) => ({ id, recipeMultiplier: D(mult), extraIngredientId: null, extraQty: null });
const db = (sizeItems: { optionId: string; ingredientId: string; quantity: Prisma.Decimal }[]) => ({
  product: { findMany: async () => [{ id: "p", recipe: { items: [{ ingredientId: "orange", quantity: D(200) }], sizeItems } }] },
  modifierOption: { findMany: async () => [option("s300"), option("s500", 1.5)] },
}) as never;

describe("computeNeeds: граммовка по размерам", () => {
  const sizes = [
    { optionId: "s300", ingredientId: "orange", quantity: D(300) },
    { optionId: "s500", ingredientId: "orange", quantity: D(500) },
  ];
  it("300 мл и 500 мл списывают каждый свои граммы", async () => {
    const n = await computeNeeds(db(sizes), [{ productId: "p", quantity: 2, optionIds: ["s300"] }, { productId: "p", quantity: 1, optionIds: ["s500"] }]);
    expect(n.get("orange")?.toNumber()).toBe(2 * 300 + 500);
  });
  it("без строк по размерам работает старое правило: база × коэффициент", async () => {
    const n = await computeNeeds(db([]), [{ productId: "p", quantity: 2, optionIds: ["s500"] }]);
    expect(n.get("orange")?.toNumber()).toBe(2 * 200 * 1.5);
  });
});
