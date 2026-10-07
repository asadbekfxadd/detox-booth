import type { Metadata, Viewport } from "next";
import "@fontsource-variable/caveat";
import "@fontsource-variable/onest";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: "Vitamin B",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Vitamin B", locale: "ru_RU", title: "Vitamin B — fresh juice bar", description: "Натуральные фрукты, настоящий вкус: свежие соки, смузи, боулы и салаты. Закажите онлайн и заберите готовым.", images: [{ url: "/brand/family.jpg", alt: "Vitamin B — juice & fresh" }] },
  twitter: { card: "summary_large_image" },
  title: { default: "Vitamin B — fresh juice bar: соки, смузи и фреши", template: "%s · Vitamin B" },
  description: "Vitamin B — juice & fresh. Натуральные фрукты, настоящий вкус: свежие соки, смузи, боулы и салаты для взрослых и детей. Выберите точку, закажите онлайн и заберите готовым.",
};

export const viewport: Viewport = { themeColor: "#fffdf8" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
