import type { MetadataRoute } from "next";
import { getBrand } from "@/services/brand";
import { brandPalette, pageTitle } from "@/lib/brand-config";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = await getBrand();
  const cream = brandPalette(b)?.["--color-cream"] ?? "#fffdf8";
  return {
    name: pageTitle(b),
    short_name: b.name,
    description: b.description,
    start_url: "/",
    display: "standalone",
    background_color: cream,
    theme_color: cream,
    lang: "ru",
    icons: [{ src: b.logoUrl || "/brand/mark.png", sizes: "any", type: "image/png" }],
  };
}
