import { describe, it, expect } from "vitest";
import { tashkentDay } from "@/lib/time";

describe("время Ташкента", () => {
  it("21:00 UTC уже следующий день по Ташкенту", () => {
    expect(tashkentDay(new Date("2026-10-06T21:00:00Z"))).toBe("2026-10-07");
    expect(tashkentDay(new Date("2026-10-06T18:59:00Z"))).toBe("2026-10-06");
  });
});
