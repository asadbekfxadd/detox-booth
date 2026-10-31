import { HEX, contrast, darkenUntil, mix } from "@/lib/color";

/** Оформление и тексты заведения. Всё, что видит гость и сотрудник под названием бренда. */
export type Brand = {
  name: string;
  /** подпись под названием в логотипе */
  descriptor: string;
  /** рукописная фраза в подвале и на главной */
  tagline: string;
  /** заголовок вкладки и поисковой выдачи; пусто — «Название — подпись» */
  seoTitle: string;
  /** описание для поисковиков и ссылок */
  description: string;
  /** текст в подвале под фразой */
  footerText: string;
  /** картинка логотипа: путь на сайте или https-ссылка; пусто — монограмма */
  logoUrl: string;
  instagram: string;
  /** основной цвет: заголовки, шапка, тёмные блоки */
  primary: string;
  /** акцентный цвет: кнопки и выделения */
  accent: string;
  ticker: string[];
  /** vitaminb — витрина с фото и подборками Vitamin B; classic — универсальная главная для любого заведения */
  homeStyle: "vitaminb" | "classic";
  /** показывать ли Мандаринку-помощницу */
  assistant: boolean;
  heroTitle: string;
  heroText: string;
  heroImage: string;
  /** Видео «как готовим» в первом экране: играют по очереди без звука. Прямой файл (.mp4, .webm) или YouTube. */
  heroVideos: HeroVideo[];
};

export type HeroVideo = { url: string; title: string };

export const DEFAULT_BRAND: Brand = {
  name: "Vitamin B",
  descriptor: "juice & fresh",
  tagline: "Good juice, good mood",
  seoTitle: "Vitamin B — fresh juice bar: соки, смузи и фреши",
  description: "Vitamin B — juice & fresh. Натуральные фрукты, настоящий вкус: свежие соки, смузи, боулы и салаты для взрослых и детей. Выберите точку, закажите онлайн и заберите готовым.",
  footerText: "Натуральные фрукты. Настоящий вкус. Готовим сразу после заказа.",
  logoUrl: "/brand/mark.png",
  instagram: "vitaminb.uz",
  primary: "#0d4a27",
  accent: "#ff8a00",
  ticker: ["Good juice, good mood", "Натуральные фрукты", "Настоящий вкус", "Без консервантов", "Свежие соки и смузи", "Для взрослых и детей", "Готовим сразу после заказа"],
  homeStyle: "vitaminb",
  assistant: true,
  heroTitle: "",
  heroText: "",
  heroImage: "",
  heroVideos: [],
};

/** Нейтральный бренд для нового заведения: без Vitamin B, с универсальной главной и выключенной мандаринкой. */
export const BLANK_BRAND: Brand = {
  name: "Моё заведение", descriptor: "", tagline: "", seoTitle: "", description: "Закажите онлайн и заберите готовым.", footerText: "",
  logoUrl: "", instagram: "", primary: "#1f3b4d", accent: "#e8a33d", ticker: [], homeStyle: "classic", assistant: false,
  heroTitle: "", heroText: "", heroImage: "", heroVideos: [],
};

export class BrandError extends Error {}

export const MAX_HERO_VIDEOS = 4;

/** Ссылка на видео: https-адрес или путь на сайте вида /videos/juice.mp4. Прямой файл или YouTube; остальное не пускаем. */
export function safeVideoUrl(v: string): string {
  const s = v.trim();
  if (!s) return "";
  if (/^\/(?!\/)[\w\-./%]*\.(mp4|webm|m4v|mov)$/i.test(s)) return s;
  let u: URL | null = null;
  try { u = new URL(s); } catch { /* ниже ошибка */ }
  if (u && u.protocol === "https:" && (/\.(mp4|webm|m4v|mov)$/i.test(u.pathname) || /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(u.hostname))) return u.toString();
  throw new BrandError(`Видео: «${s.slice(0, 40)}» не подходит. Нужна ссылка https:// на файл .mp4 или .webm, на YouTube, или путь вида /videos/juice.mp4`);
}

/** Строки «ссылка | подпись» (или уже готовый список) → видео для первого экрана. */
export function parseHeroVideos(raw: unknown): HeroVideo[] {
  const rows: unknown[] = Array.isArray(raw) ? raw : String(raw ?? "").split("\n");
  const out: HeroVideo[] = [];
  for (const r of rows) {
    const [url, ...rest] = typeof r === "string" ? r.split("|") : [String((r as HeroVideo)?.url ?? ""), String((r as HeroVideo)?.title ?? "")];
    const safe = safeVideoUrl(String(url ?? ""));
    if (!safe) continue;
    out.push({ url: safe, title: clean(rest.join("|"), 60) });
  }
  if (out.length > MAX_HERO_VIDEOS) throw new BrandError(`Видео на главной: не больше ${MAX_HERO_VIDEOS}`);
  return out;
}

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Ссылка на картинку: путь вида /brand/logo.png или https-адрес. Остальное (javascript:, data:) не пускаем. */
export function safeImageUrl(v: string): string {
  const s = v.trim();
  if (!s) return "";
  if (/^\/(?!\/)[\w\-./%]*$/.test(s)) return s;
  try { const u = new URL(s); if (u.protocol === "https:") return u.toString(); } catch { /* ниже ошибка */ }
  throw new BrandError("Ссылка на картинку должна начинаться с https:// или с /");
}

/** Ник в Instagram из ника, @ника или ссылки. */
export function parseInstagram(v: string): string {
  const s = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  if (!s) return "";
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw new BrandError("Instagram: только латинские буквы, цифры, точка и подчёркивание");
  return s;
}

/** Сырой ввод (форма или JSON из базы) → готовый бренд. Бросает BrandError с понятным текстом. */
export function parseBrand(raw: Record<string, unknown>): Brand {
  const name = clean(raw.name, 40);
  if (!name) throw new BrandError("Укажите название заведения");
  const primary = clean(raw.primary, 7).toLowerCase();
  const accent = clean(raw.accent, 7).toLowerCase();
  if (!HEX.test(primary)) throw new BrandError("Основной цвет: нужен код вида #0d4a27");
  if (!HEX.test(accent)) throw new BrandError("Акцентный цвет: нужен код вида #ff8a00");
  if (contrast(primary, "#ffffff") < 4.5) throw new BrandError("Основной цвет слишком светлый: белый текст на нём не читается. Выберите темнее.");
  const deep = mix(primary, "#000000", 0.4);
  if (contrast(accent, deep) < 4.5) throw new BrandError("Акцентный цвет слишком тёмный: текст на кнопках не читается. Выберите светлее.");
  const tickerRaw = Array.isArray(raw.ticker) ? raw.ticker : String(raw.ticker ?? "").split("\n");
  const ticker = tickerRaw.map((t) => clean(t, 40)).filter(Boolean).slice(0, 10);
  const homeStyle = raw.homeStyle === "classic" ? "classic" : "vitaminb";
  return {
    name,
    descriptor: clean(raw.descriptor, 40),
    tagline: clean(raw.tagline, 60),
    seoTitle: clean(raw.seoTitle, 70),
    description: clean(raw.description, 220),
    footerText: clean(raw.footerText, 160),
    logoUrl: safeImageUrl(String(raw.logoUrl ?? "")),
    instagram: parseInstagram(String(raw.instagram ?? "")),
    primary, accent, ticker, homeStyle,
    assistant: raw.assistant === true || raw.assistant === "on" || raw.assistant === "true",
    heroTitle: clean(raw.heroTitle, 80),
    heroText: clean(raw.heroText, 220),
    heroImage: safeImageUrl(String(raw.heroImage ?? "")),
    heroVideos: parseHeroVideos(raw.heroVideos),
  };
}

/** Данные из базы могли устареть или быть испорчены: берём что можно, остальное по умолчанию. */
export function brandFromStored(v: unknown, base: Brand = DEFAULT_BRAND): Brand {
  if (!v || typeof v !== "object") return base;
  try { return parseBrand({ ...base, ...(v as Record<string, unknown>) }); } catch { return base; }
}

/** Цвета сайта, посчитанные от двух выбранных. Для стандартных цветов Vitamin B возвращаем null: стили не меняются. */
export function brandPalette(b: Brand): Record<string, string> | null {
  if (b.primary === DEFAULT_BRAND.primary && b.accent === DEFAULT_BRAND.accent) return null;
  const cream = mix("#ffffff", b.accent, 0.03);
  return {
    "--color-forest": b.primary,
    "--color-forest-deep": mix(b.primary, "#000000", 0.4),
    "--color-orange": b.accent,
    "--color-orange-deep": darkenUntil(b.accent, cream, 4.5),
    "--color-sun": mix(b.accent, "#ffffff", 0.25),
    "--color-leaf": mix(b.primary, "#ffffff", 0.15),
    "--color-leaf-soft": mix(b.primary, "#ffffff", 0.9),
    "--color-cream": cream,
    "--color-sand": mix(b.accent, "#ffffff", 0.85),
    "--color-muted": mix(b.primary, "#ffffff", 0.35),
  };
}

export const paletteCss = (p: Record<string, string> | null) =>
  p ? `:root{${Object.entries(p).map(([k, v]) => `${k}:${v}`).join(";")}}` : "";

/** Сменили название, а заголовок вкладки не трогали: он остался от прежнего бренда, поэтому сбрасываем его на «Название — подпись». */
export const withNameChange = (next: Brand, before: Brand): Brand =>
  next.name !== before.name && next.seoTitle === before.seoTitle ? { ...next, seoTitle: "" } : next;

export const pageTitle = (b: Brand) => b.seoTitle || (b.descriptor ? `${b.name} — ${b.descriptor}` : b.name);

/** «Vitamin B» → «Vitamin» и «B»: последнее слово названия выделяем акцентным цветом. */
export function splitName(name: string): [string, string] {
  const i = name.lastIndexOf(" ");
  return i < 0 ? [name, ""] : [name.slice(0, i), name.slice(i + 1)];
}
