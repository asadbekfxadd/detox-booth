import type { Metadata, Viewport } from "next";
import "@fontsource-variable/caveat";
import "@fontsource-variable/onest";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";
import { getBrand } from "@/services/brand";
import { brandPalette, paletteCss, pageTitle } from "@/lib/brand-config";

// Название, цвета и тексты берутся из настроек, поэтому страницы строим на запросе.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  const title = pageTitle(b);
  return {
    metadataBase: new URL(siteUrl()),
    applicationName: b.name,
    openGraph: { type: "website", siteName: b.name, locale: "ru_RU", title, description: b.description, images: (b.heroImage || (b.homeStyle === "vitaminb" ? "/brand/family.jpg" : b.logoUrl)) ? [{ url: b.heroImage || (b.homeStyle === "vitaminb" ? "/brand/family.jpg" : b.logoUrl), alt: b.name }] : undefined },
    twitter: { card: "summary_large_image" },
    title: { default: title, template: `%s · ${b.name}` },
    description: b.description,
    icons: { icon: b.logoUrl || "/brand/mark.png" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const b = await getBrand();
  return { themeColor: brandPalette(b)?.["--color-cream"] ?? "#fffdf8", viewportFit: "cover" };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const css = paletteCss(brandPalette(await getBrand()));
  return (
    <html lang="ru" className="h-full antialiased">
      <head>{css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}</head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
