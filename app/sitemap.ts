import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic"; // меню меняется в админке, на сборке базы может не быть

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const products = await prisma.product.findMany({ where: { isArchived: false, isAvailable: true }, select: { slug: true, updatedAt: true } }).catch(() => []);
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/menu`, changeFrequency: "daily", priority: 0.9 },
    ...products.map((p) => ({ url: `${base}/menu/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
