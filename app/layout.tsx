import type { Metadata, Viewport } from "next";
import "@fontsource-variable/unbounded";
import "@fontsource-variable/onest";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DETOX BOOTH — смузи, боулы и фреши", template: "%s · DETOX BOOTH" },
  description: "Здоровая еда и напитки в Ташкенте: смузи, фреши, боулы, салаты. Выберите точку, закажите онлайн и заберите готовым.",
};

export const viewport: Viewport = { themeColor: "#f5f7ea" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
