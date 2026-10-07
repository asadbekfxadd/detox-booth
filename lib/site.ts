import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SITE_LOC_COOKIE = "site_loc";

/** Активные точки и выбранная клиентом точка (cookie), по умолчанию — первая. */
export const getSiteLocation = cache(async () => {
  const locations = await prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, address: true } });
  const c = (await cookies()).get(SITE_LOC_COOKIE)?.value;
  const current = locations.find((l) => l.id === c) ?? locations[0] ?? null;
  return { locations, current };
});
