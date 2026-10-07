import { describe, it, expect } from "vitest";
import { buildSlots, checkScheduled } from "@/lib/slots";

const NOW = Date.parse("2026-10-07T07:03:00Z"); // 12:03 в Ташкенте

describe("слоты получения", () => {
  it("первый слот — с учётом подготовки, кратен 15 минутам", () => {
    const s = buildSlots(NOW, 15);
    expect(s[0]).toBe("2026-10-07T07:30:00.000Z"); // 07:18 -> 07:30
    expect(s.every((x) => Date.parse(x) % (15 * 60_000) === 0)).toBe(true);
    expect(Date.parse(s.at(-1)!)).toBeLessThanOrEqual(NOW + 12 * 3_600_000);
  });
  it("проверка времени", () => {
    expect(checkScheduled("мусор", NOW, 15).ok).toBe(false);
    expect(checkScheduled(new Date(NOW + 5 * 60_000).toISOString(), NOW, 15).ok).toBe(false);
    expect(checkScheduled(new Date(NOW + 30 * 60_000).toISOString(), NOW, 15).ok).toBe(true);
    expect(checkScheduled(new Date(NOW + 30 * 3_600_000).toISOString(), NOW, 15).ok).toBe(false);
  });
});
