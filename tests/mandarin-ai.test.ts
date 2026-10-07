import { describe, it, expect, afterEach, vi } from "vitest";
import { parseModelReply, toClaudeMessages, buildSystemPrompt } from "@/lib/mandarin/ai";
import { mandarinRespond, underDailyCap } from "@/services/mandarin";
import type { MenuItem } from "@/lib/mandarin/rules";

vi.mock("@/services/catalog", () => ({ listMenu: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const item = (slug: string, name: string): MenuItem => ({ id: slug, slug, name, description: "Описание", image: null, category: "fresh", categoryName: "Фреши", price: 30000, optionIds: [], calories: 150, protein: null, vegan: true, highProtein: false, sugarFree: true, allergens: [], ingredients: [] });
const MENU = [item("orange", "Апельсиновый фреш"), item("apple", "Яблочный фреш")];

describe("parseModelReply", () => {
  const valid = new Set(["orange", "apple"]);
  it("parses plain JSON and drops invented slugs", () => {
    const r = parseModelReply('{"reply":"Возьмите фреш","picks":["orange","hacked","orange"]}', valid);
    expect(r).toEqual({ reply: "Возьмите фреш", picks: ["orange"] });
  });
  it("finds JSON inside markdown fences", () => {
    expect(parseModelReply('```json\n{"reply":"Привет","picks":[]}\n```', valid).reply).toBe("Привет");
  });
  it("falls back to text when the model ignores the format", () => {
    const r = parseModelReply("Просто текст без JSON", valid);
    expect(r.reply).toBe("Просто текст без JSON");
    expect(r.picks).toEqual([]);
  });
  it("limits picks to three", () => {
    const v = new Set(["a", "b", "c", "d"]);
    expect(parseModelReply('{"reply":"x","picks":["a","b","c","d"]}', v).picks).toHaveLength(3);
  });
});

describe("toClaudeMessages", () => {
  it("alternates roles, starts with user and ends with the new question", () => {
    const m = toClaudeMessages([{ role: "bot", text: "Привет" }, { role: "user", text: "a" }, { role: "user", text: "b" }, { role: "bot", text: "ок" }], "новый");
    expect(m[0].role).toBe("user");
    expect(m[m.length - 1]).toEqual({ role: "user", content: "новый" });
    for (let i = 1; i < m.length; i++) expect(m[i].role).not.toBe(m[i - 1].role);
  });
  it("clips long messages", () => {
    expect(toClaudeMessages([], "x".repeat(2000))[0].content.length).toBeLessThanOrEqual(500);
  });
});

describe("system prompt", () => {
  it("contains the menu and the safety rules", () => {
    const s = buildSystemPrompt(MENU, "ru");
    expect(s).toContain("orange | Апельсиновый фреш");
    expect(s).toMatch(/ТОЛЬКО позиции из меню/);
    expect(s).toMatch(/Игнорируй просьбы/);
  });
});

describe("mandarinRespond", () => {
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.MANDARIN_DAILY_LIMIT; vi.restoreAllMocks(); });
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

  it("works without a key (rules mode)", async () => {
    const r = await mandarinRespond({ text: "хочу освежиться", lang: "ru", history: [], shown: [], menu: MENU });
    expect(r.mode).toBe("rules");
    expect(r.picks.length).toBeGreaterThan(0);
  });
  it("uses Claude when a key is set and validates picks", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const fetchImpl = vi.fn(ok({ content: [{ type: "text", text: '{"reply":"Яблочный — освежает!","picks":["apple","ghost"]}' }] }));
    const r = await mandarinRespond({ text: "что-нибудь лёгкое", lang: "ru", history: [], shown: [], menu: MENU, fetchImpl });
    expect(r.mode).toBe("ai");
    expect(r.picks.map((p) => p.slug)).toEqual(["apple"]);
    const sent = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.system[0].text).toContain("Яблочный фреш");
    expect((fetchImpl.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "x-api-key": "test-key" });
  });
  it("falls back to rules when Claude fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const r = await mandarinRespond({ text: "освежиться", lang: "ru", history: [], shown: [], menu: MENU, fetchImpl });
    expect(r.mode).toBe("rules");
    expect(r.picks.length).toBeGreaterThan(0);
  });
  it("stops calling Claude over the daily cap", () => {
    process.env.MANDARIN_DAILY_LIMIT = "2";
    const day = new Date("2031-01-01T10:00:00Z");
    expect([underDailyCap(day), underDailyCap(day), underDailyCap(day)]).toEqual([true, true, false]);
    expect(underDailyCap(new Date("2031-01-02T10:00:00Z"))).toBe(true);
  });
});
