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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/((?!print/).*)", headers: security },
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
