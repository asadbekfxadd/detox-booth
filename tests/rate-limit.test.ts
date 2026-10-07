import { describe, it, expect, beforeEach } from "vitest";
import { hit, reset, _clear } from "@/lib/rate-limit";

describe("ограничитель частоты", () => {
  beforeEach(() => _clear());
  it("пропускает до лимита и блокирует сверх него", () => {
    for (let i = 0; i < 3; i++) expect(hit("k", 3, 1000, 0).ok).toBe(true);
    const r = hit("k", 3, 1000, 10);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(1);
  });
  it("окно сбрасывается по времени", () => {
    for (let i = 0; i < 4; i++) hit("k", 3, 1000, 0);
    expect(hit("k", 3, 1000, 1001).ok).toBe(true);
  });
  it("ключи независимы, reset очищает", () => {
    hit("a", 1, 1000, 0); expect(hit("a", 1, 1000, 1).ok).toBe(false);
    expect(hit("b", 1, 1000, 1).ok).toBe(true);
    reset("a"); expect(hit("a", 1, 1000, 2).ok).toBe(true);
  });
});
