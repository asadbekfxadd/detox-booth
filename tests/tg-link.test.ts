import { describe, it, expect } from "vitest";
import { makeLinkToken, readLinkToken, linkPayload, LINK_TTL_MS } from "@/lib/tg-link";

const S = "test-secret";
const NOW = 1_800_000_000_000;
const ID = "clx9a8b7c0000abcd1234efgh";

describe("токен привязки Telegram", () => {
  it("круг: токен возвращает id сотрудника", () => {
    expect(readLinkToken(makeLinkToken(ID, NOW, S), NOW + 1000, S)).toBe(ID);
  });
  it("укладывается в лимит Telegram: link_ + токен ≤ 64", () => {
    expect(("link_" + makeLinkToken(ID, NOW, S)).length).toBeLessThanOrEqual(64);
    expect(/^[A-Za-z0-9_-]+$/.test("link_" + makeLinkToken(ID, NOW, S))).toBe(true);
  });
  it("через 15 минут уже недействителен", () => {
    const t = makeLinkToken(ID, NOW, S);
    expect(readLinkToken(t, NOW + LINK_TTL_MS - 5000, S)).toBe(ID);
    expect(readLinkToken(t, NOW + LINK_TTL_MS + 5000, S)).toBeNull();
  });
  it("чужой секрет, подмена id, подмена срока, мусор", () => {
    const t = makeLinkToken(ID, NOW, S);
    expect(readLinkToken(t, NOW, "other")).toBeNull();
    expect(readLinkToken(t.replace(ID, "clxOTHER000000000000000000"), NOW, S)).toBeNull();
    const [id, , sig] = t.split("_");
    expect(readLinkToken(`${id}_zzzzzz_${sig}`, NOW, S)).toBeNull();
    expect(readLinkToken("", NOW, S)).toBeNull();
    expect(readLinkToken("a_b", NOW, S)).toBeNull();
    expect(readLinkToken("x".repeat(80), NOW, S)).toBeNull();
    expect(readLinkToken(t, NOW, "")).toBeNull();
  });
  it("linkPayload берёт только параметры с префиксом link_", () => {
    expect(linkPayload("link_abc")).toBe("abc");
    expect(linkPayload("ref_abc")).toBeNull();
    expect(linkPayload(undefined)).toBeNull();
  });
});
