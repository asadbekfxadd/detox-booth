import { listMenu } from "@/services/catalog";
import { rulesReply, detectLang, whyText, parseWishes, followChips, STARTER_CHIPS, type Lang, type MenuItem, type Pick } from "@/lib/mandarin/rules";
import { buildSystemPrompt, parseModelReply, toClaudeMessages, type Turn } from "@/lib/mandarin/ai";

export type MandarinPick = { id: string; slug: string; name: string; price: number; image: string | null; category: string; optionIds: string[]; calories: number | null; why: string };
export type MandarinResult = { reply: string; picks: MandarinPick[]; chips: string[]; mode: "ai" | "rules"; lang: Lang };

const toDto = (p: Pick): MandarinPick => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image, category: p.category, optionIds: p.optionIds, calories: p.calories, why: p.why });

/** Меню для подбора: только то, что можно заказать сейчас. Короткий кэш, чтобы не ходить в БД на каждое сообщение. */
const cache = new Map<string, { at: number; menu: MenuItem[] }>();
export async function menuForAssistant(locationId: string | null): Promise<MenuItem[]> {
  const key = locationId ?? "all";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30_000) return hit.menu;
  const rows = await listMenu(locationId);
  const menu = rows.filter((p) => p.available).map<MenuItem>((p) => ({
    id: p.id, slug: p.slug, name: p.name, description: p.description, image: p.image, category: p.category.slug, categoryName: p.category.name,
    price: p.defaultPrice, optionIds: p.defaultOptionIds, calories: p.calories, protein: p.protein,
    vegan: p.isVegan, highProtein: p.isHighProtein, sugarFree: p.isSugarFree, allergens: p.allergens, ingredients: p.ingredients,
  }));
  cache.set(key, { at: Date.now(), menu });
  return menu;
}

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Дневной потолок сообщений к ИИ, чтобы счёт за API не вышел из-под контроля. Дальше работает режим без ИИ. */
const daily = { day: "", count: 0 };
export function underDailyCap(now = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  if (daily.day !== day) { daily.day = day; daily.count = 0; }
  const cap = Number(process.env.MANDARIN_DAILY_LIMIT ?? 600);
  if (daily.count >= cap) return false;
  daily.count++;
  return true;
}

type FetchLike = typeof fetch;

export async function askClaude(p: { menu: MenuItem[]; lang: Lang; history: Turn[]; text: string; fetchImpl?: FetchLike }): Promise<{ reply: string; slugs: string[] }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY не задан");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    const res = await (p.fetchImpl ?? fetch)(process.env.ANTHROPIC_API_URL ?? "https://api.anthropic.com/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.MANDARIN_MODEL ?? "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: [{ type: "text", text: buildSystemPrompt(p.menu, p.lang), cache_control: { type: "ephemeral" } }],
        messages: toClaudeMessages(p.history, p.text),
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const raw = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    const parsed = parseModelReply(raw, new Set(p.menu.map((m) => m.slug)));
    return { reply: parsed.reply, slugs: parsed.picks };
  } finally { clearTimeout(timer); }
}

/** Главный вход: ИИ, если есть ключ и лимит, иначе (или при сбое) подбор по правилам. */
export async function mandarinRespond(p: { text: string; lang: Lang; history: Turn[]; shown: string[]; menu: MenuItem[]; fetchImpl?: FetchLike }): Promise<MandarinResult> {
  const lang = detectLang(p.text, p.lang);
  if (aiEnabled() && underDailyCap()) {
    try {
      const { reply, slugs } = await askClaude({ menu: p.menu, lang, history: p.history, text: p.text, fetchImpl: p.fetchImpl });
      const bySlug = new Map(p.menu.map((m) => [m.slug, m]));
      const wishes = parseWishes([...p.history.filter((t) => t.role === "user").map((t) => t.text), p.text].join(". "));
      const picks = slugs.map((s) => bySlug.get(s)).filter((x): x is MenuItem => !!x).map((m) => ({ ...m, why: whyText(m, wishes, lang) }));
      return { reply, picks: picks.map(toDto), chips: picks.length ? followChips(wishes, lang) : STARTER_CHIPS[lang].slice(0, 4), mode: "ai", lang };
    } catch (e) {
      console.error("[MANDARIN AI]", e instanceof Error ? e.message : e); // без ключа и тела запроса
    }
  }
  const r = rulesReply({ text: p.text, lang, history: p.history.filter((t) => t.role === "user").map((t) => t.text), shown: p.shown, menu: p.menu });
  return { reply: r.reply, picks: r.picks.map(toDto), chips: r.chips, mode: "rules", lang };
}
