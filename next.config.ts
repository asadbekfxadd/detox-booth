import type { NextConfig } from "next";

// Заголовки безопасности для всех страниц. CSP без script-src намеренно: Next.js вставляет инлайновые скрипты,
// а nonce-политика потребует динамического рендера каждой страницы. Остальные директивы закрывают встраивание,
// подмену base, отправку форм на чужие домены и плагины.
const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

// Страницы печати кухня открывает во встроенном (скрытом) окне своего же сайта для автопечати, поэтому им разрешено встраивание только с того же адреса.
const printSecurity = security.map((h) =>
  h.key === "X-Frame-Options" ? { ...h, value: "SAMEORIGIN" }
  : h.key === "Content-Security-Policy" ? { ...h, value: h.value.replace("frame-ancestors 'none'", "frame-ancestors 'self'") }
  : h);

// Сайт открывается в Telegram Mini App: в версии Telegram для браузера он встроен во фрейм с адресов telegram.org.
// Разрешаем встраивание только им и только страницам клиентского сайта; кабинет, касса и остальное по-прежнему закрыты.
const TELEGRAM_FRAMES = "frame-ancestors 'self' https://web.telegram.org https://webk.telegram.org https://webz.telegram.org https://*.telegram.org";
const siteSecurity = security
  .filter((h) => h.key !== "X-Frame-Options") // этот заголовок не умеет перечислять несколько адресов, роль берёт CSP frame-ancestors
  .map((h) => (h.key === "Content-Security-Policy" ? { ...h, value: h.value.replace("frame-ancestors 'none'", TELEGRAM_FRAMES) } : h));
const STAFF = ["admin", "pos", "waiter", "kitchen", "courier", "login", "api", "after-login", "forbidden"];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      // клиентский сайт: можно встраивать в Telegram
      { source: `/((?!(?:${STAFF.join("|")}|print)(?:/|$)).*)`, headers: siteSecurity },
      // кабинет, касса, кухня и т.д.: встраивание запрещено
      ...STAFF.map((p) => ({ source: `/${p}/:path*`, headers: security })),
      { source: "/print/:path*", headers: printSecurity },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
