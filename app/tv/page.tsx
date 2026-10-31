import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { listCategories, listMenu } from "@/services/catalog";
import { getBrand } from "@/services/brand";
import { siteUrl } from "@/lib/site-url";
import { buildTvPages, clampSec } from "@/lib/tv";
import { splitName } from "@/lib/brand-config";
import { TvBoard } from "@/components/tv/TvBoard";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

/** Меню для телевизора в зале. Открывается без входа: /tv?loc=<точка>&sec=<секунд на позицию>. */
export default async function TvPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const locs = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const loc = locs.find((l) => l.id === sp.loc) ?? locs[0] ?? null;
  const [items, cats, brand] = await Promise.all([listMenu(loc?.id ?? null), listCategories(), getBrand()]);
  const pages = buildTvPages(items, cats);
  const qrUrl = loc ? `${siteUrl()}/l/${loc.id}` : `${siteUrl()}/menu`;
  const qr = await QRCode.toDataURL(qrUrl, { margin: 0, width: 300, color: { dark: "#072d17", light: "#ffffff" } });
  const [first, last] = splitName(brand.name);
  const word: [string, string] = brand.name === "Vitamin B" ? ["VITAMIN", "B"] : [first.toUpperCase(), last.toUpperCase()];
  return (
    <TvBoard
      pages={pages} sec={clampSec(sp.sec)} qr={qr} locationName={loc?.name ?? ""}
      brand={{ word, descriptor: brand.descriptor, logoUrl: brand.logoUrl, initial: brand.name.trim().charAt(0).toUpperCase(), ticker: brand.ticker, tagline: brand.tagline }}
    />
  );
}
