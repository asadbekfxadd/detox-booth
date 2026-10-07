import type { Metadata, Viewport } from "next";
import "@fontsource-variable/caveat";
import "@fontsource-variable/onest";
import "./globals.css";

export const metadata: Metadata = {
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
