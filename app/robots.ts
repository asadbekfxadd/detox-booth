import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/pos", "/api", "/login", "/forbidden", "/order/", "/cart", "/checkout"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
